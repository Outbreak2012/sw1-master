import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { ColumnData } from './proyecto/interfaces';
import { GoogleGenAI, Type } from "@google/genai";
import { environment } from '../environments/environment';
export interface ChatMessage {
  user: string;
  name: string;
  tempId?: string; // <-- ID temporal único
  message?: string;
  timestamp?: Date;
  x?: number;
  y?: number;
  atributos?: any[];
  relaciones?: {
    targetTempId: string; // <-- ID temporal de la tabla destino
    tipoName?: string;
    multsource?: string;
    multtarget?: string;
    detalle?: string;
    sourceName?: string;
    targetName?: string;
    sourceArgs?: any;
    targetArgs?: any;
  }[];
}



export interface DatabaseDescription {
  titulo: string;
  descripcion: string;
  tablas: {
    name: string;
    descripcion: string;
    atributos: any[];
    relaciones: any[];
  }[];
}




export interface TablaGenerada {
  id: string;
  nombre: string;
  atributos: AtributoGenerado[];
  relaciones: RelacionGenerada[];
}

export interface AtributoGenerado {
  contenido: string;
  // Opcional: propiedades parseadas
  nombre?: string;
  tipo?: string;
  clave?: boolean;
}

export interface RelacionGenerada {
  contenido: string;
  // Opcional: propiedades parseadas
  cardinalidad1?: string;
  cardinalidad2?: string;
  tipo?: string;
  destino?: string;
  nombre_rol?: string;
}

@Injectable({
  providedIn: 'root'
})



export class ChatService {
  private messageSubject = new Subject<ChatMessage[]>();


  private ai = new GoogleGenAI({
    apiKey: environment.GOOGLE_GENAI_API_KEY
  });

  async chat(tipoBD: string) {
    const prompt = `Genera un arreglo de objetos JSON para un diagrama de base de datos para ${tipoBD}. 
  Cada objeto debe representar una tabla y tener las siguientes propiedades:
  - id: un identificador único para la tabla (puede ser un string corto como "t1", "t2", etc.)
  - nombre: el nombre de la tabla (debe ser un nombre sustantivo en singular, como "usuario", "producto", etc.)
  - atributos: un arreglo de objetos, cada uno con las propiedades:
    - contenido: una cadena que combine el nombre del atributo y su tipo de dato (int, string, date, char, boolean, byte, double). El formato debe ser "+_nombre_tipo_false" donde el último valor siempre es false (no generar llaves primarias automáticamente).
  - relaciones: un arreglo de objetos, cada uno con las propiedades:
    - contenido: una cadena que se divide en tres partes separadas por guiones bajos. 
    La primera parte es la multiplicidad de la tabla origen  (1..1, 1..*, *, etc.), 
    la segunda parte es la multiplicidad de la tabla destino (1..1, 1..*, *, etc.),
    la tercera parte es el tipo ("asociacion","agregacion","composicion","herencia),
    la cuarta parte es el id de la tabla con la que se relaciona.
    la quinta parte es el nombre del rol que describe la relación (ejemplo: "perteneceA", "tieneEmpleados", "esPropietarioDe", "trabajaEn", "contiene", "gestiona", etc.)
    no uses guiones bajos en los nombres de tablas ni atributos  . 

  [
  {
     "id"=t1
    "nombre": "categoria",
    "atributos": [
      
      { "contenido": "+_nombre_string_false" }
      { "contenido": "+_descripcion_string_false" }
    ],
    "relaciones": []
  }
  {
    "id"=t2 
    "nombre": "producto",
    "atributos": [
     
       { "contenido": "+_nombre_string_false" },
        { "contenido": "+_precio_double_false" },
    ],
    "relaciones": [
      { "contenido": "1..*_0..1_asociacion_t1_contiene" }
    ]
  },

]

  `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              nombre: { type: Type.STRING },
              atributos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    contenido: { type: Type.STRING },
                  }
                }
              },
              relaciones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    contenido: { type: Type.STRING },

                  }
                }
              }
            },
            propertyOrdering: [
              "id", "nombre", "atributos", "relaciones"
            ]
          }
        }
      }
    });

    //console.log(response.text, "resultado de gemini");
    return response.text;
  }




  sendMessages(messages: ChatMessage[]) {
    this.messageSubject.next(messages);
  }

  getMessages(): Observable<ChatMessage[]> {
    return this.messageSubject.asObservable();
  }



  mapearTablas(tablas: TablaGenerada[]): TablaGenerada[] {
    return (tablas || []).map(tabla => ({
      ...tabla,
      atributos: (tabla.atributos || []).map(attr => {
        const partes = attr.contenido.split('_');
        return {
          ...attr,
          nombre: partes[1],
          tipo: partes[2],
          clave: partes[3] === 'true'
        };
      }),
      relaciones: (tabla.relaciones || []).map(rel => {
        // Ejemplo: "1..*_asociacion_t5"
        const partes = (rel.contenido || '').split('_');
        return {
          ...rel,
          cardinalidad1: partes[0],
          cardinalidad2: partes[1],
          tipo: partes[2],
          destino: partes[3],
          nombre_rol: partes[4] || 'rol_desconocido'
        };
      })
    }));
  }





  convertirAChatMessages(tablas: TablaGenerada[]): ChatMessage[] {
    const tablasMapeadas = this.mapearTablas(tablas);

    return tablasMapeadas.map((tabla, index) => {
      const tempId = `temp_${tabla.id}`;
      return {
        user: 'AI',
        name: tabla.nombre,
        tempId: tempId,
        message: `Tabla ${tabla.nombre}`,
        timestamp: new Date(),
        x: 150 + (index * 200), // Posiciones progresivas
        y: 100 + (index * 150),
        atributos: tabla.atributos.map(attr => ({
          name: attr.nombre || 'campo',
          type: attr.tipo || 'string',
          key: attr.clave || false,
          scope: 'public'
        })),
        relaciones: tabla.relaciones.map(rel => ({
          targetTempId: `temp_${rel.destino}`, // Mapea al tempId de la tabla destino
          tipoName: rel.tipo || 'asociacion',
          multsource: rel.cardinalidad1 || '1',
          multtarget: rel.cardinalidad2 || '1',
          nombre_rol: rel.nombre_rol || 'rol_desconocido',
          detalle: `${rel.nombre_rol} ${rel.destino}`,
        }))
      };
    });
  }





  // ...existing code...
  async chat_normalizar(projectData: any): Promise<string> {
    try {
      if (!projectData || !projectData.tables) {
        throw new Error('No hay datos del proyecto para normalizar');
      }

      // Preparar información de las tablas existentes
      const tablasInfo = projectData.tables.map((table: any) => {
        const attrs = table.atributos?.map((attr: any) =>
          `${attr.name} (${attr.type}${attr.key ? ', PK' : ''})`
        ).join(', ') || 'Sin atributos';

        const rels = projectData.relations
          ?.filter((rel: any) => rel.sourceId === table.id)
          .map((rel: any) => `${rel.relationType || 'asociacion'} con ${rel.targetName || 'tabla'} (${rel.sourceMultiplicity || '1'}:${rel.targetMultiplicity || '1'})`)
          .join(', ') || '';

        return `Tabla: ${table.nombre || table.name}, Atributos: [${attrs}]${rels ? `, Relaciones: [${rels}]` : ''}`;
      }).join('. ');

      const prompt = `Analiza el siguiente diagrama de base de datos y genera una versión normalizada siguiendo las reglas de normalización (1FN, 2FN, 3FN).

DATOS ACTUALES DEL DIAGRAMA:
${tablasInfo}

INSTRUCCIONES:
1. Aplica normalización eliminando dependencias parciales y transitivas
2. Cada tabla debe tener una clave primaria clara
3. Separa entidades que estén mezcladas
4. Elimina redundancias de datos
5. Mantén la integridad referencial
Formato de salida: un arreglo de objetos JSON para un diagrama de base de datos.
Cada objeto debe representar una tabla y tener las siguientes propiedades:
  - id: un identificador único para la tabla (puede ser un string corto como "t1", "t2", etc.)
  - nombre: el nombre de la tabla (debe ser un nombre sustantivo en singular, como "usuario", "producto", etc.)
  - atributos: un arreglo de objetos, cada uno con las propiedades:
    - contenido: una cadena que combine el nombre del atributo y su tipo de dato (int, string, date, char, boolean, byte, double). El formato debe ser "+_nombre_tipo_false" donde el último valor siempre es false (no generar llaves primarias automáticamente).
  - relaciones: un arreglo de objetos, cada uno con las propiedades:
    - contenido: una cadena que se divide en tres partes separadas por guiones bajos. 
    La primera parte es la multiplicidad de la tabla origen  (1..1, 1..*, *, etc.), 
    la segunda parte es la multiplicidad de la tabla destino (1..1, 1..*, *, etc.),
    la tercera parte es el tipo ("asociacion","agregacion","composicion","herencia),
    la cuarta parte es el id de la tabla con la que se relaciona.
    la quinta parte es el nombre del rol que describe la relación (ejemplo: "perteneceA", "tieneEmpleados", "esPropietarioDe", "trabajaEn", "contiene", "gestiona", etc.)
    no uses guiones bajos en los nombres de tablas ni atributos  . 

  [
  {
     "id"=t1
    "nombre": "categoria",
    "atributos": [
      { "contenido": "+_nombre_string_false" },
      { "contenido": "+_descripcion_string_false" }
    ],
    "relaciones": []
  }
  {
    "id"=t2 
    "nombre": "producto",
    "atributos": [
     
       { "contenido": "+_nombre_string_false" },
       { "contenido": "+_precio_double_false" }, 

    ],
    "relaciones": [
      { "contenido": "1..*_0..1_asociacion_t1_contiene" }
    ]
  },

]
`;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                nombre: { type: Type.STRING },
                atributos: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      contenido: { type: Type.STRING },
                    }
                  }
                },
                relaciones: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      contenido: { type: Type.STRING },
                    }
                  }
                }
              },
              propertyOrdering: [
                "id", "nombre", "atributos", "relaciones"
              ]
            }
          }
        }
      });

      console.log('Respuesta de normalización:', response.text);
      return response.text || '[]';

    } catch (error) {
      console.error('Error en chat_normalizar:', error);
      if (error instanceof Error) {
        throw new Error(`Error al normalizar: ${error.message}`);
      } else {
        throw new Error('Error al normalizar: error desconocido');
      }
    }
  }
  // ...existing code...





  // ...existing code...

  async generarDocumentacion(responseText: string): Promise<string> {
    try {
      const tablas = JSON.parse(responseText);

      if (!Array.isArray(tablas) || tablas.length === 0) {
        return 'No se encontraron tablas para documentar.';
      }

      let documentacion = '📊 DOCUMENTACIÓN DE BASE DE DATOS\n\n';
      documentacion += `📈 Resumen: Se generaron ${tablas.length} tabla(s)\n\n`;

      tablas.forEach((tabla, index) => {
        documentacion += `🗂️ TABLA ${index + 1}: ${tabla.nombre.toUpperCase()}\n`;
        documentacion += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        // Atributos
        if (tabla.atributos && tabla.atributos.length > 0) {
          documentacion += `📝 Atributos (${tabla.atributos.length}):\n`;
          tabla.atributos.forEach((attr: { contenido: string; }, attrIndex: number) => {
            const partes = attr.contenido.split('_');
            const nombre = partes[1] || 'campo';
            const tipo = partes[2] || 'string';
            const esClave = partes[3] === 'true';

            documentacion += `  ${attrIndex + 1}. ${nombre} (${tipo})${esClave ? ' 🔑' : ''}\n`;
          });
          documentacion += '\n';
        }

        // Relaciones
        if (tabla.relaciones && tabla.relaciones.length > 0) {
          documentacion += `🔗 Relaciones (${tabla.relaciones.length}):\n`;
          tabla.relaciones.forEach((rel: { contenido: string; }, relIndex: number) => {
            const partes = rel.contenido.split('_');
            const multOrigen = partes[0] || '1';
            const multDestino = partes[1] || '1';
            const nombreRol = partes[2] || 'relación';
            const tablaDestino = partes[3] || 'tabla';

            documentacion += `  ${relIndex + 1}. ${nombreRol} → ${tablaDestino} (${multOrigen}:${multDestino})\n`;
          });
          documentacion += '\n';
        }

        documentacion += '\n';
      });

      // Estadísticas finales
      const totalAtributos = tablas.reduce((total, tabla) =>
        total + (tabla.atributos ? tabla.atributos.length : 0), 0);
      const totalRelaciones = tablas.reduce((total, tabla) =>
        total + (tabla.relaciones ? tabla.relaciones.length : 0), 0);

      documentacion += `📊 ESTADÍSTICAS GENERALES\n`;
      documentacion += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      documentacion += `• Total de tablas: ${tablas.length}\n`;
      documentacion += `• Total de atributos: ${totalAtributos}\n`;
      documentacion += `• Total de relaciones: ${totalRelaciones}\n`;
      documentacion += `• Promedio de atributos por tabla: ${Math.round(totalAtributos / tablas.length * 100) / 100}\n`;

      return documentacion;

    } catch (error) {
      console.error('Error al generar documentación:', error);
      return 'Error: No se pudo procesar la respuesta para generar la documentación.';
    }
  }

  // ...existing code...
  async generarDocumentacionHTML(responseText: string): Promise<string> {
    try {
      const tablas = JSON.parse(responseText);

      if (!Array.isArray(tablas) || tablas.length === 0) {
        return 'No se encontraron tablas para documentar.';
      }

      let doc = '📊 BASE DE DATOS GENERADA\n';
      doc += '═══════════════════════════════════════\n\n';
      doc += `✅ Se crearon ${tablas.length} tabla(s) exitosamente\n\n`;

      tablas.forEach((tabla, index) => {
        doc += '─'.repeat(40) + '\n';
        doc += `🗂️  TABLA ${index + 1}: ${tabla.nombre.toUpperCase()}\n`;


        // Atributos
        if (tabla.atributos && tabla.atributos.length > 0) {
          doc += `📝 Campos (${tabla.atributos.length}):\n`;
          tabla.atributos.forEach((attr: { contenido: string; }, i: number) => {
            const partes = attr.contenido.split('_');
            const nombre = partes[1] || 'campo';
            const tipo = partes[2] || 'string';
            const esClave = partes[3] === 'true';

            doc += `   ${i + 1}. ${nombre} (${tipo})${esClave ? ' 🔑' : ''}\n`;
          });
          doc += '\n';
        }

        // Relaciones
        if (tabla.relaciones && tabla.relaciones.length > 0) {
          doc += `🔗 Relaciones (${tabla.relaciones.length}):\n`;
          tabla.relaciones.forEach((rel: { contenido: string; }, i: number) => {
            const partes = rel.contenido.split('_');
            const multOrigen = partes[0] || '1';
            const multDestino = partes[1] || '1';
            const nombreRol = partes[2] || 'relación';
            const tablaDestino = partes[3] || 'tabla';

            doc += `   ${i + 1}. ${nombreRol} → ${tablaDestino} (${multOrigen}:${multDestino})\n`;
          });
          doc += '\n';
        }

        doc += '\n';
      });

      // Resumen final
      const totalAtributos = tablas.reduce((total, tabla) =>
        total + (tabla.atributos ? tabla.atributos.length : 0), 0);
      const totalRelaciones = tablas.reduce((total, tabla) =>
        total + (tabla.relaciones ? tabla.relaciones.length : 0), 0);

      doc += '📊 RESUMEN GENERAL\n';
      doc += '═══════════════════════════════════════\n';
      doc += `• Tablas creadas: ${tablas.length}\n`;
      doc += `• Total campos: ${totalAtributos}\n`;
      doc += `• Total relaciones: ${totalRelaciones}\n`;
      doc += `• Promedio campos/tabla: ${Math.round(totalAtributos / tablas.length * 10) / 10}\n\n`;
      doc += '🎉 ¡Base de datos lista para usar!';

      return doc;

    } catch (error) {
      console.error('Error al generar documentación:', error);
      return '❌ Error: No se pudo procesar la respuesta para generar la documentación.';
    }
  }
  // ...existing code...
  // ...existing code...








}
