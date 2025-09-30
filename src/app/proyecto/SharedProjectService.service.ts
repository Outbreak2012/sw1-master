import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedProjectService {
  private projectComponentRef: any = null;

  setProjectComponent(component: any) {
    this.projectComponentRef = component;
  }

  getProjectData(): any {
    if (this.projectComponentRef && this.projectComponentRef.getCurrentProjectData) {
      return this.projectComponentRef.getCurrentProjectData();
    }
    return null;
  }


  // ⚠️ Nuevo método para limpiar el diagrama
  async clearDiagram(): Promise<void> {
    if (this.projectComponentRef && this.projectComponentRef.clearAllTablesAndRelations) {
      await this.projectComponentRef.clearAllTablesAndRelations();
    } else {
      throw new Error('No se pudo acceder al método de limpieza del diagrama');
    }
  }

  // Método para acceder al gráfico directamente
  getGraph(): any {
    if (this.projectComponentRef && this.projectComponentRef.graph) {
      return this.projectComponentRef.graph;
    }
    return null;
  }
}