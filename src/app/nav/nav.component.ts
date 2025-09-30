import { Component, HostListener, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, NavigationEnd, ActivatedRoute } from '@angular/router';
import { UsersService } from '../users.service';
import { v4 as uuidv4 } from 'uuid';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../project.service';
import { ChatMessage, ChatService } from '../chat.service';
import { SharedProjectService } from '../proyecto/SharedProjectService.service';

declare function showAndHide(): any;
@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit {

  constructor(
    private readonly userService: UsersService,
    private router: Router,
    private readonly projectService: ProjectService,

    private chatService: ChatService,

     private sharedProjectService: SharedProjectService,
    private route: ActivatedRoute) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;
      }
    });
  }
  open = false;
  isAuthenticated: boolean = false;
  isAdmin: boolean = false;
  isUser: boolean = false;
  asideOpen = false;
  currentRoute: string = '';
  dropdownIndex: number | null = null;
  isAddUserDropdownOpen: boolean = false;
  projectName: string = '';
  users: any[] = [];
  currentUrl: string = '';
  email: string = '';
  accessLevel: string = 'ver';
  projectId: string = '';
  token: string | null = '';

  chatInput: string = ''; // Variable para el input del chat
  chatresult: string = ''; // Variable para el resultado del chat
  showChatbot = false;
   isHtmlContent = false; // Nueva propiedad para controlar si es HTML

  ngOnInit(): void {
    this.currentUrl = window.location.href;
    this.userService.authStatus$.subscribe(status => {
      this.isAuthenticated = status;
      this.isAdmin = this.userService.isAdmin();
      this.isUser = this.userService.isUser();
    });
    this.userService.projectName$.subscribe((name: string) => {
      this.projectName = name;
    });
    this.userService.users$.subscribe((users: any[]) => {
      this.users = users;
    });
    this.userService.projectId$.subscribe((id: string) => {
      this.projectId = id;
    });
  }

  logout(): void {
    this.userService.logOut();
  }

  copyToClipboard() {
    const inputElement = document.getElementById('link') as HTMLInputElement;
    if (inputElement) {
      inputElement.select();
      inputElement.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(this.currentUrl).then(
        () => {
          console.log('Texto copiado al portapapeles');
        },
        (err) => {
          console.error('Error al copiar texto', err);
        }
      );
    }
  }

  toggleMenu() {
    this.open = !this.open;
  }
  createNewDiagram() {
    const newDiagramId = uuidv4();
    this.router.navigate(['/proyecto', newDiagramId]);
  }

  toggleDropdown(index: number) {
    this.dropdownIndex = this.dropdownIndex === index ? null : index;
  }

  toggleAddUserDropdown() {
    this.isAddUserDropdownOpen = !this.isAddUserDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent) {
    const clickedInside = (event.target as HTMLElement).closest('.relative');
    if (!clickedInside) {
      this.open = false;
    }
  }
  toggleAside() {
    this.asideOpen = !this.asideOpen;
  }
  get isProjectRoute(): boolean {
    return this.router.url.includes('/proyecto');
  }
  handleEnter() {
    this.token = localStorage.getItem('token');
    console.log(this.projectId);
    console.log(this.token)
    if (this.email && this.accessLevel && this.projectId && this.token) {
      const projectData = {
        email: this.email,
        proyectoId: this.projectId,
        permiso: this.accessLevel
      };
      this.sendInvite(projectData, this.token);
    } else {
      console.error('Faltan datos necesarios para enviar la invitación');
    }
  }

  async sendInvite(projectData: any, token: string) {
    try {
      const response = await this.projectService.enviarInvitacion(projectData, token);
      this.isAddUserDropdownOpen = false;
    } catch (error) {
      console.error('Error al enviar la invitación:', error);
    }
  }




  async enviarMensaje() {
    const tempId1 = uuidv4();
    const tempId2 = uuidv4();

    const chatMessage: ChatMessage = {
      user: 'User',
      name: 'NewTable',
      tempId: tempId1,
      message: this.chatInput,
      timestamp: new Date(),
      x: 100,
      y: 100,
      atributos: [
        { name: 'id', type: 'int', key: true, scope: 'public' },
        { name: 'name', type: 'string', scope: 'public' },
        { name: 'email', type: 'string', scope: 'private' }
      ],
      relaciones: [
        {
          targetTempId: tempId2, // Relación hacia la segunda tabla
          tipoName: 'asociacion',
          multsource: '1',
          multtarget: 'N',
          detalle: 'relación ejemplo'
        }
      ]
    };

    const chatMessage2: ChatMessage = {
      user: 'User',
      name: 'NewTable2',
      tempId: tempId2,
      message: this.chatInput,
      timestamp: new Date(),
      x: 200,
      y: 200,
      atributos: [

        { name: 'name', type: 'string', scope: 'public' },
        { name: 'email', type: 'string', scope: 'private' }
      ]
      // No relaciones en este ejemplo
    };

    this.chatresult = '🤖 Generando base de datos...';
    
    this.chatService.chat(this.chatInput).then(async responseText => {
      console.log('Respuesta del chat:', responseText);  
         const documentacionHTML = await this.chatService.generarDocumentacionHTML(responseText ?? '');
         this.chatresult = documentacionHTML;
         this.isHtmlContent = false;
         let respuesta=this.chatService.convertirAChatMessages(responseText ? JSON.parse(responseText) : []);   
         this.chatService.sendMessages(respuesta);
      this.chatInput = '';
    });

  }

 // ...existing code...
async normalizar() {
  try {
    // Obtener los datos del proyecto actual
    const projectData = this.sharedProjectService.getProjectData();
    
    console.log('Datos del proyecto a normalizar:', projectData);
    if (!projectData) {
      console.error('No se pudieron obtener los datos del proyecto');
      this.chatresult = 'Error: No se pudieron obtener los datos del proyecto';
      return;
    }

    this.chatresult = '🧹 Limpiando diagrama actual...';
    this.isHtmlContent = false;
    
    // ⚠️ PASO 1: Limpiar todas las tablas y relaciones existentes
    const projectComponent = this.sharedProjectService['projectComponentRef'];
    if (projectComponent && projectComponent.clearAllTablesAndRelations) {
      await projectComponent.clearAllTablesAndRelations();
      console.log('Diagrama limpiado exitosamente');
    } else {
      console.error('No se pudo acceder al método de limpieza');
      this.chatresult = 'Error: No se pudo limpiar el diagrama actual';
      return;
    }
    
    // ⚠️ PASO 2: Generar la versión normalizada
    this.chatresult = '🔧 Normalizando base de datos...';
    const normalizedResponse = await this.chatService.chat_normalizar(projectData);
    
    // ⚠️ PASO 3: Crear las nuevas tablas normalizadas
    const normalizedData = JSON.parse(normalizedResponse);
    const chatMessages = this.chatService.convertirAChatMessages(normalizedData);
    
    // Enviar los mensajes normalizados (esto creará las nuevas tablas)
    this.chatService.sendMessages(chatMessages);
    
    // ⚠️ PASO 4: Generar documentación
    const documentacion = await this.chatService.generarDocumentacionHTML(normalizedResponse);
    this.chatresult = documentacion;
    
    console.log(`Normalización completada. Se crearon ${chatMessages.length} tablas normalizadas.`);
    
  } catch (error) {
    console.error('Error en la normalización:', error);
    const errorMessage = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: string }).message
      : String(error);
    this.chatresult = `❌ Error al normalizar el proyecto: ${errorMessage}`;
  }
}
// ...existing code...







  

}
