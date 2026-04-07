// ============================================
// OLM INGENIERÍA SAS - APP Firebase
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyBpW1ZLMZkpjbsBWiCRA3W15DHO2x-1aTE",authDomain:"olmapp.firebaseapp.com",
    projectId:"olmapp",storageBucket:"olmapp.firebasestorage.app",messagingSenderId:"936967827188",
    appId:"1:936967827188:web:7581731966a851725638a1"};
const fbApp=initializeApp(firebaseConfig);
const db=getFirestore(fbApp);
// Drive
const DRIVE_CID="936967827188-479uovu5dirg6c6h8768u7a4h9jpqi81.apps.googleusercontent.com";
let _driveTok=null,_driveFid=null;
function driveIsConnected(){return!!_driveTok;}
async function conectarDrive(){try{await new Promise((res,rej)=>{google.accounts.oauth2.initTokenClient({client_id:DRIVE_CID,scope:'https://www.googleapis.com/auth/drive.file',callback:(r)=>{if(r.error){rej(r.error);return;}_driveTok=r.access_token;res();}}).requestAccessToken();});actualizarTopbar();toast('☁️ Drive conectado');}catch(e){toast('❌ Drive: '+e);}}
async function driveUploadHTML(html,name){if(!_driveTok)return;if(!_driveFid){const r=await fetch(`https://www.googleapis.com/drive/v3/files?q=name='OLM_Informes'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`,{headers:{Authorization:`Bearer ${_driveTok}`}});const d=await r.json();if(d.files&&d.files.length>0){_driveFid=d.files[0].id;}else{const c=await fetch('https://www.googleapis.com/drive/v3/files',{method:'POST',headers:{Authorization:`Bearer ${_driveTok}`,'Content-Type':'application/json'},body:JSON.stringify({name:'OLM_Informes',mimeType:'application/vnd.google-apps.folder'})});_driveFid=(await c.json()).id;}}const form=new FormData();form.append('metadata',new Blob([JSON.stringify({name,mimeType:'text/html',parents:[_driveFid]})],{type:'application/json'}));form.append('file',new Blob([html],{type:'text/html'}));await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{Authorization:`Bearer ${_driveTok}`},body:form});}

// ===== DATOS =====
let clientes=[],equipos=[],servicios=[],tecnicos=[];

async function cargarDatos(){
    const main=document.getElementById('mainContent');
    main.innerHTML='<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando...</p></div>';
    try{
        const[cs,es,ss,ts]=await Promise.all([
            getDocs(query(collection(db,'clientes'),orderBy('nombre'))),
            getDocs(collection(db,'equipos')),
            getDocs(query(collection(db,'servicios'),orderBy('fecha','desc'))),
            getDocs(collection(db,'tecnicos'))
        ]);
        clientes=cs.docs.map(d=>({id:d.id,...d.data()}));
        equipos=es.docs.map(d=>({id:d.id,...d.data()}));
        servicios=ss.docs.map(d=>({id:d.id,...d.data()}));
        tecnicos=ts.docs.map(d=>({id:d.id,...d.data()}));
    }catch(err){
        console.error('Error:',err);
        toast('⚠️ Error de conexión');
        main.innerHTML='<div class="page" style="text-align:center;padding:2rem;"><p>⚠️ Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

async function sembrarDatos(){
    const snap=await getDocs(collection(db,'tecnicos'));
    if(!snap.empty)return;
    toast('⚙️ Configurando app...');
    const cRef=await addDoc(collection(db,'clientes'),{nombre:'Cliente Demo SAS',telefono:'3100000000',email:'demo@clientedemo.com',ciudad:'Bucaramanga',direccion:'Calle 1 # 1-1',latitud:null,longitud:null,fechaCreacion:new Date().toISOString().split('T')[0]});
    const eRef=await addDoc(collection(db,'equipos'),{clienteId:cRef.id,marca:'APC',modelo:'Smart-UPS 3000',serie:'UPS-2024-001',ubicacion:'Sala de servidores',tipo:'UPS'});
    await addDoc(collection(db,'servicios'),{equipoId:eRef.id,tipo:'Mantenimiento',fecha:new Date().toISOString().split('T')[0],tecnico:'Oscar Leonardo Martínez',descripcion:'Revisión general UPS. Sistema óptimo.',proximoMantenimiento:new Date(Date.now()+180*24*60*60*1000).toISOString().split('T')[0],fotos:[]});
    await addDoc(collection(db,'tecnicos'),{nombre:'Oscar Leonardo Martínez',cedula:'0000001',tipoDoc:'CC',telefono:'3114831801',cargo:'Administrador',rol:'admin',especialidades:['mecanico','baja','media'],region:'Colombia',clave:'1234'});
    toast('✅ Listo. Cédula: 0000001 · Clave: 1234');
}

const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Bucaramanga', 'Barranquilla',
    'Cúcuta', 'Manizales', 'Pereira', 'Ibagué', 'Villavicencio',
    'Girón', 'Floridablanca', 'Piedecuesta', 'Pamplona', 'Soacha'];

const TIPOS_DOC = ['CC', 'CE', 'PA', 'NIT', 'TI'];

const EMPRESA = { nombre: 'OLM INGENIERÍA SAS', nit: '901.050.468-5', contacto: 'Oscar Leonardo Martínez', telefono: '311 4831801', ciudad: 'Bogotá' };

// ===== ESTADO =====
let currentView   = 'panel';
let sesionActual  = null; // { tecnico obj }
let selectedClienteId = null;
let selectedEquipoId  = null;
const fotosNuevas = [null, null, null];
const stExt = new Array(10).fill(false);
const stInt = new Array(10).fill(false);

const CK_EXT = ['LIMPIEZA GENERAL','REVISIÓN CONEXIONES','AJUSTE TORNILLERÍA',
    'REVISIÓN PROTECCIONES','CAMBIO DE CONTACTOR','CAMBIO CONDENSADOR',
    'CAMBIO CAPACITOR','REPARACIÓN DE FUGA','RECARGA DE GAS','REVISIÓN ACOMETIDA'];
const CK_INT = ['LIMPIEZA GENERAL','LIMPIEZA SERPENTINES','LIMPIEZA DRENAJES',
    'REPARACIÓN TARJETA','AJUSTE CORREAS','REPARACIÓN FUGA',
    'CAMBIO DE BLOWER','REPARACIÓN MOTOR','REVISIÓN ELÉCTRICA','OTROS'];

let _esidActual   = null;
let _fotosEditadas = [];

// ===== HELPERS =====
const getEq  = id => equipos.find(e => e.id === id);
const getCl  = id => clientes.find(c => c.id === id);
const getTec = id => tecnicos.find(t => t.id === id);
const getEquiposCliente  = cid => equipos.filter(e => e.clienteId === cid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosCliente = cid => servicios.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));

function genId() { return '_' + Math.random().toString(36).substr(2, 9); }

function fmtFecha(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES');
}
function fmtFechaLarga(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function getMesActual() { return new Date().toISOString().slice(0, 7); }

// ===== PERMISOS =====
function esAdmin() { return sesionActual?.rol === 'admin'; }
function esPropietario(creadoPor) { return sesionActual?.nombre === creadoPor; }
function puedeEditar(creadoPor) { return esAdmin() || esPropietario(creadoPor); }

// ===== TOAST =====
function toast(msg, duration = 2500) {
    const t = document.getElementById('toastEl');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ===== OVERLAY / MODAL =====
function showModal(html) {
    const ov = document.getElementById('overlayEl');
    ov.innerHTML = html;
    ov.classList.remove('hidden');
    ov.onclick = e => { if (e.target === ov) closeModal(); };
}
function closeModal() {
    const ov = document.getElementById('overlayEl');
    ov.classList.add('hidden');
    ov.innerHTML = '';
    fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;
}

// ===== TOPBAR SESION =====
function actualizarTopbar() {
    const right = document.getElementById('topbarRight');
    if (!right) return;
    if (!sesionActual) {
        right.innerHTML = `<span class="topbar-user" id="topbarUser">Sin sesión</span>`;
    } else {
        const initials = sesionActual.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
        const rolBadge = esAdmin()
            ? `<span class="topbar-rol-badge">Admin</span>`
            : '';
        right.innerHTML = `
            <div class="topbar-sesion">
                <div class="topbar-avatar">${initials}</div>
                <div>
                    <div style="font-size:0.68rem;color:white;font-weight:700;line-height:1;">${sesionActual.nombre.split(' ')[0]}</div>
                    ${rolBadge}
                </div>
                ${driveIsConnected()?'<span style="font-size:0.6rem;color:#4ade80;font-weight:700;">☁️</span>':'<button class="topbar-salir" style="background:#1a73e8;padding:4px 8px;" onclick="conectarDrive()">☁️</button>'}
                <button class="topbar-salir" onclick="cerrarSesion()">Salir</button>
            </div>`;
    }
}

function cerrarSesion() {
    sesionActual = null;
    actualizarTopbar();
    renderView();
    toast('👋 Sesión cerrada');
}

// ===== NAVEGACIÓN =====
function goTo(view, cid = null, eid = null) {
    currentView = view;
    selectedClienteId = cid;
    selectedEquipoId  = eid;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'detalle'   && b.dataset.page === 'clientes') ||
            (view === 'historial' && b.dataset.page === 'clientes'));
    });
}

// Menús disponibles sin sesión: panel y tecnicos

function renderView() {
    const main = document.getElementById('mainContent');
    document.getElementById('botnavEl').style.display = 'flex';

    switch (currentView) {
        case 'panel':         main.innerHTML = renderPanel(); break;
        case 'clientes':      main.innerHTML = renderClientes(); break;
        case 'detalle':       main.innerHTML = renderDetalleCliente(); break;
        case 'historial':     main.innerHTML = renderHistorial(); break;
        case 'equipos':       main.innerHTML = renderEquipos(); break;
        case 'servicios':     main.innerHTML = renderServicios(); aplicarFiltros(); break;
        case 'mantenimientos':main.innerHTML = renderMantenimientos(); break;
        case 'tecnicos':      main.innerHTML = renderTecnicos(); break;
        default:              main.innerHTML = renderPanel();
    }
}

// ===== LOGIN =====
function renderLogin() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
    <div class="login-screen">
        <div class="login-logo-area">
            <img src="OLM_LOGO.png" style="max-height:80px;max-width:220px;object-fit:contain;margin-bottom:10px;" alt="OLM" onerror="this.style.display='none'">
            <div class="login-brand">OLM INGENIERÍA SAS</div>
            <div class="login-sub">Plantas y Sistemas Eléctricos</div>
        </div>
        <div class="login-card">
            <div class="login-card-title">🔑 Iniciar sesión</div>
            <label class="fl first">Cédula</label>
            <input class="fi" id="loginCedula" placeholder="Ingresa tu número de cédula" type="number"
                oninput="resetPin()">
            <label class="fl">Clave (4 dígitos)</label>
            <div class="pin-display">
                <div class="pin-digit" id="pd0"></div>
                <div class="pin-digit" id="pd1"></div>
                <div class="pin-digit" id="pd2"></div>
                <div class="pin-digit" id="pd3"></div>
            </div>
            <div class="numpad">
                ${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="num-btn" onclick="pinPress(${n})">${n}</div>`).join('')}
                <div class="num-btn del" onclick="pinDel()">⌫</div>
                <div class="num-btn zero" onclick="pinPress(0)">0</div>
                <div class="num-btn ok"  onclick="doLogin()">✓</div>
            </div>
            <div id="loginMsg"></div>
            <button class="btn-login" onclick="doLogin()">Ingresar</button>
        </div>
        <div class="login-footer">OLM Ingeniería SAS · Bogotá · v1.0 DEMO</div>
    </div>`;
}

let pinActual = '';
function resetPin() { pinActual = ''; updatePinDisplay(); document.getElementById('loginMsg').innerHTML = ''; }
function pinPress(n) {
    if (pinActual.length >= 4) return;
    pinActual += String(n);
    updatePinDisplay();
    if (pinActual.length === 4) doLogin();
}
function pinDel() {
    pinActual = pinActual.slice(0, -1);
    updatePinDisplay();
}
function updatePinDisplay() {
    for (let i = 0; i < 4; i++) {
        const d = document.getElementById('pd' + i);
        if (!d) return;
        d.className = 'pin-digit';
        if (i < pinActual.length) { d.textContent = '●'; d.classList.add('filled'); }
        else if (i === pinActual.length) { d.textContent = '_'; d.classList.add('active'); }
        else { d.textContent = ''; }
    }
}
function doLogin() {
    const cedula = document.getElementById('loginCedula')?.value?.trim();
    const msg = document.getElementById('loginMsg');
    if (!cedula) {
        msg.innerHTML = '<div class="login-warn">⚠️ Ingresa tu número de cédula</div>'; return;
    }
    if (pinActual.length < 4) {
        msg.innerHTML = '<div class="login-warn">⚠️ Ingresa tu clave de 4 dígitos</div>'; return;
    }
    const tec = tecnicos.find(t => t.cedula === cedula && t.clave === pinActual);
    if (!tec) {
        msg.innerHTML = '<div class="login-error">❌ Cédula o clave incorrecta. Intenta de nuevo.</div>';
        pinActual = ''; updatePinDisplay(); return;
    }
    sesionActual = tec;
    pinActual = '';
    actualizarTopbar();
    currentView = 'panel';
    renderView();
    toast(`✅ Bienvenido, ${tec.nombre.split(' ')[0]}`);
}

// ===== PANEL =====
function renderPanel() {
    const año = new Date().getFullYear();
    const mes = getMesActual();
    const man  = servicios.filter(s => s.tipo === 'Mantenimiento');
    const rep  = servicios.filter(s => s.tipo === 'Reparación');
    const inst = servicios.filter(s => s.tipo === 'Instalación');
    const manM = man.filter(s => s.fecha?.startsWith(mes));
    const repM = rep.filter(s => s.fecha?.startsWith(mes));
    const instM= inst.filter(s => s.fecha?.startsWith(mes));
    const nuevosDelMes = clientes.filter(c => c.fechaCreacion?.startsWith(mes)).length;

    // Panel sin links — solo estadísticas
    return `<div class="page">
        <div class="panel-banner">
            <div class="panel-banner-sub">Plantas y Sistemas Eléctricos</div>
            <div class="panel-banner-title">Panel Principal</div>
        </div>
        <div class="panel-grid">
            <div class="panel-col">
                <div class="panel-col-head">Clientes</div>
                <div class="panel-box gold-box">
                    <div class="panel-box-num">${clientes.length}</div>
                    <div class="panel-box-lbl">TOTALES</div>
                </div>
                <div class="panel-box gold-box">
                    <div class="panel-box-num">${nuevosDelMes}</div>
                    <div class="panel-box-lbl">NUEVOS MES</div>
                </div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box anual-box">
                    <div class="panel-box-lbl">ANUAL</div>
                </div>
                <div class="panel-box anual-box">
                    <div class="panel-box-num">${man.length}</div>
                    <div class="panel-box-lbl">MANTENIMIENTO</div>
                </div>
                <div class="panel-box anual-box">
                    <div class="panel-box-num">${rep.length}</div>
                    <div class="panel-box-lbl">REPARACIÓN</div>
                </div>
                <div class="panel-box anual-box">
                    <div class="panel-box-num">${inst.length}</div>
                    <div class="panel-box-lbl">INSTALACIÓN</div>
                </div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box mensual-box">
                    <div class="panel-box-lbl">MENSUAL</div>
                </div>
                <div class="panel-box mensual-box">
                    <div class="panel-box-num">${manM.length}</div>
                    <div class="panel-box-lbl">MANTENIMIENTO</div>
                </div>
                <div class="panel-box mensual-box">
                    <div class="panel-box-num">${repM.length}</div>
                    <div class="panel-box-lbl">REPARACIÓN</div>
                </div>
                <div class="panel-box mensual-box">
                    <div class="panel-box-num">${instM.length}</div>
                    <div class="panel-box-lbl">INSTALACIÓN</div>
                </div>
            </div>
        </div>`;
}

// ===== CLIENTES =====
function renderClientes() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Clientes (${clientes.length})</h2>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoCliente()">+ Nuevo</button>
        </div>
        <input class="search" placeholder="🔍 Buscar por nombre, ciudad, teléfono..."
            oninput="filtrarClientes(this.value)" id="searchClientes">
        <div id="clientesGrid">
            ${clientes.map(c => `
            <div class="cc" data-search="${(c.nombre+c.ciudad+c.telefono+(c.email||'')).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div class="cc-name">${c.nombre}</div>
                    <div style="display:flex;gap:4px;">
                        ${esAdmin() ? `<button class="ib" onclick="modalEditarCliente('${c.id}')">✏️</button>
                        <button class="ib" onclick="modalEliminarCliente('${c.id}')">🗑️</button>` : ''}
                    </div>
                </div>
                <div class="cc-row">📞 ${c.telefono}</div>
                ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
                <div class="cc-row">📍 ${c.direccion}</div>
                <span class="city-tag">${c.ciudad}</span>
                ${c.latitud ? `<div style="margin-top:4px;"><a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver GPS</a></div>` : ''}
                <div class="cc-meta">${getEquiposCliente(c.id).length} activo(s) · ${getServiciosCliente(c.id).length} servicio(s)</div>
                <button class="link-btn" onclick="goTo('detalle','${c.id}')">Ver activos y servicios →</button>
            </div>`).join('')}
        </div>
    </div>`;
}

function filtrarClientes(v) {
    const txt = v.toLowerCase();
    document.querySelectorAll('#clientesGrid .cc').forEach(c => {
        c.style.display = (c.dataset.search||'').includes(txt) ? '' : 'none';
    });
}

// ===== DETALLE CLIENTE =====
function renderDetalleCliente() {
    const c = getCl(selectedClienteId);
    if (!c) { goTo('clientes'); return ''; }
    const eqs = getEquiposCliente(c.id);
    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('clientes')">← Volver</button>
            <div>
                <div style="font-size:0.92rem;font-weight:700;">${c.nombre}</div>
                <div style="font-size:0.72rem;color:var(--hint);">${c.ciudad}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="cc-row">📞 <strong>${c.telefono}</strong></div>
            ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
            <div class="cc-row">📍 ${c.direccion}</div>
            ${c.latitud ? `<a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver en Google Maps</a>`
                : '<div style="font-size:0.72rem;color:var(--hint);">Sin GPS registrado</div>'}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
            <span style="font-size:0.9rem;font-weight:700;">Activos (${eqs.length})</span>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${c.id}')">+ Activo</button>
        </div>
        ${eqs.length === 0 ? '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1rem;">Sin activos. Agrega uno.</p>' : ''}
        ${eqs.map(e => `
        <div class="ec">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <div class="ec-name">${e.marca} ${e.modelo}</div>
                    <div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie||'S/N'}</div>
                    <div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s) registrado(s)</div>
                </div>
                <div style="display:flex;gap:4px;">
                    ${esAdmin() ? `<button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button>
                    <button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button>` : ''}
                </div>
            </div>
            <div class="ec-btns">
                <button class="ab" onclick="goTo('historial','${c.id}','${e.id}')">📋 Servicios</button>
                <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo servicio</button>
                <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
            </div>
        </div>`).join('')}
    </div>`;
}

// ===== HISTORIAL =====
function renderHistorial() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('clientes'); return ''; }
    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(e.id).sort((a,b) => new Date(b.fecha)-new Date(a.fecha));
    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('detalle','${e.clienteId}')">← Volver</button>
            <div>
                <div style="font-size:0.88rem;font-weight:700;">${e.marca} ${e.modelo}</div>
                <div style="font-size:0.72rem;color:var(--hint);">${e.ubicacion} · ${c?.nombre}</div>
            </div>
        </div>
        <div style="margin-bottom:0.65rem;">
            <span style="font-size:0.88rem;font-weight:700;">Historial (${ss.length})</span>
        </div>
        ${ss.length===0 ? '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1rem;">Sin servicios registrados.</p>' : ''}
        ${ss.map(s => `
        <div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparación'?'b-red':'b-green'}">${s.tipo}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
                    ${puedeEditar(s.tecnico) ? `<button class="ib" style="padding:3px 7px;min-height:28px;" onclick="modalEditarServicio('${s.id}')">✏️</button>` : ''}
                    ${esAdmin() ? `<button class="ib" style="padding:3px 7px;min-height:28px;" onclick="eliminarServicio('${s.id}')">🗑️</button>` : ''}
                </div>
            </div>
            <div class="si-info">🔧 ${s.tecnico}</div>
            <div class="si-info" style="color:#64748b;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.78rem;color:var(--gold);margin-top:3px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">
                ${(s.fotos||[]).map(f=>`<img class="fthumb" src="${f}" loading="lazy">`).join('')}
                ${!(s.fotos||[]).length ? '<span style="font-size:0.72rem;color:var(--hint);">Sin fotos</span>' : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

// ===== ACTIVOS (EQUIPOS) =====
function renderEquipos() {
    return `<div class="page">
        <div class="sec-head"><h2>Activos (${equipos.length})</h2></div>
        <input class="search" placeholder="🔍 Buscar activo o cliente..." oninput="filtrarEquipos(this.value)" id="searchEq">
        <div id="equiposGrid">
        ${equipos.map(e => {
            const c = getCl(e.clienteId);
            return `<div class="ec" data-search="${(e.marca+e.modelo+(c?.nombre||'')).toLowerCase()}">
                <div class="ec-name">${e.marca} ${e.modelo}</div>
                <div class="ec-meta">👤 ${c?.nombre||'Sin cliente'} · 📍 ${e.ubicacion}</div>
                <div class="ec-btns">
                    <button class="ab" onclick="goTo('historial','${e.clienteId}','${e.id}')">📋 Servicios</button>
                    <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
                    <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                </div>
            </div>`;
        }).join('')}
        </div>
    </div>`;
}
function filtrarEquipos(v) {
    document.querySelectorAll('#equiposGrid .ec').forEach(c => {
        c.style.display = (c.dataset.search||'').includes(v.toLowerCase()) ? '' : 'none';
    });
}

// ===== SERVICIOS =====
function renderServicios() {
    const años = [...new Set(servicios.map(s=>s.fecha?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `<div class="page">
        <div class="sec-head"><h2>Servicios</h2></div>
        <div class="filtros">
            <select class="fi" id="fAnio"><option value="">Todos los años</option>${años.map(a=>`<option>${a}</option>`).join('')}</select>
            <select class="fi" id="fMes"><option value="">Todos los meses</option>${meses.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('')}</select>
            <select class="fi" id="fTipo"><option value="">Todos los tipos</option><option>Mantenimiento</option><option>Reparación</option><option>Instalación</option></select>
            <select class="fi" id="fCliente"><option value="">Todos los clientes</option>${clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
            <select class="fi" id="fTecnico"><option value="">Todos los técnicos</option>${tecnicos.map(t=>`<option>${t.nombre}</option>`).join('')}</select>
            <button class="btn btn-blue btn-full" onclick="aplicarFiltros()">Aplicar filtros</button>
            <button class="btn btn-gray btn-full" onclick="limpiarFiltros()">Limpiar filtros</button>
        </div>
        <div id="listaServicios"></div>
    </div>`;
}

function aplicarFiltros() {
    const anio = document.getElementById('fAnio')?.value||'';
    const mes  = document.getElementById('fMes')?.value||'';
    const tipo = document.getElementById('fTipo')?.value||'';
    const cid  = document.getElementById('fCliente')?.value||'';
    const tec  = document.getElementById('fTecnico')?.value||'';
    let filtrados = [...servicios].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    if (anio) filtrados = filtrados.filter(s=>s.fecha?.startsWith(anio));
    if (mes)  filtrados = filtrados.filter(s=>s.fecha?.slice(5,7)===mes);
    if (tipo) filtrados = filtrados.filter(s=>s.tipo===tipo);
    if (cid)  filtrados = filtrados.filter(s=>getEquiposCliente(cid).some(e=>e.id===s.equipoId));
    if (tec)  filtrados = filtrados.filter(s=>s.tecnico===tec);
    const el = document.getElementById('listaServicios');
    if (!el) return;
    if (!filtrados.length) { el.innerHTML='<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1.5rem;">Sin resultados.</p>'; return; }
    el.innerHTML = filtrados.map(s => {
        const e = getEq(s.equipoId);
        const c = getCl(e?.clienteId);
        return `<div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparación'?'b-red':'b-green'}">${s.tipo}</span>
                <span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
            </div>
            <div class="si-info">👤 ${c?.nombre||'N/A'} · ${e?.marca||''} ${e?.modelo||''}</div>
            <div class="si-info">📍 ${e?.ubicacion||''} · 🔧 ${s.tecnico}</div>
            <div class="si-info" style="color:#64748b;">${s.descripcion}</div>
            ${s.proximoMantenimiento?`<div style="font-size:0.75rem;color:var(--gold);margin-top:2px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>`:''}
        </div>`;
    }).join('');
}
function limpiarFiltros() {
    ['fAnio','fMes','fTipo','fCliente','fTecnico'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    aplicarFiltros();
}

// ===== AGENDA =====
function renderMantenimientos() {
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const año = new Date().getFullYear();
    const mant = servicios.filter(s=>s.proximoMantenimiento);
    return `<div class="page">
        <div class="sec-head"><h2>Agenda ${año}</h2></div>
        <div class="tbl-wrap">
            <table>
                <thead><tr><th>Mes</th><th>Fecha</th><th>Cliente</th><th>Activo</th><th></th></tr></thead>
                <tbody>
                ${MESES.map((mes,idx) => {
                    const mp = String(idx+1).padStart(2,'0');
                    const lista = mant.filter(m=>m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                    if (!lista.length) return `<tr><td style="color:var(--hint);font-size:0.72rem;background:var(--bg2);">${mes}</td><td colspan="4" style="color:#cbd5e1;font-size:0.7rem;">—</td></tr>`;
                    return lista.map((m,i) => {
                        const e = getEq(m.equipoId);
                        const c = getCl(e?.clienteId);
                        return `<tr>
                            ${i===0?`<td rowspan="${lista.length}" style="font-weight:700;font-size:0.75rem;background:var(--bg2);">${mes}</td>`:''}
                            <td>${fmtFecha(m.proximoMantenimiento)}</td>
                            <td style="font-size:0.75rem;">${c?.nombre||'N/A'}</td>
                            <td style="font-size:0.72rem;">${e?`${e.marca} ${e.modelo}`:'N/A'}</td>
                            <td><button class="rec-btn" onclick="modalRecordar('${e?.clienteId}','${e?.id}','${m.proximoMantenimiento}')">📱</button></td>
                        </tr>`;
                    }).join('');
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

// ===== TÉCNICOS =====
function renderTecnicos() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Técnicos (${tecnicos.length})</h2>
            ${esAdmin() ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>` : ''}
        </div>
        ${tecnicos.map(t => {
            const esps = (t.especialidades||[]).map(id => ESPECIALIDADES.find(e=>e.id===id)?.label||id);
            return `<div class="ec">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                    <div>
                        <div class="ec-name">${t.nombre}</div>
                        <div class="ec-meta">${t.tipoDoc} · ${t.cedula}</div>
                        <div class="ec-meta" style="margin-top:2px;">${t.cargo}</div>
                        <div class="ec-meta">📞 ${t.telefono}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                        <span class="tc-rol-badge ${t.rol==='admin'?'rol-admin':'rol-tec'}">${t.rol==='admin'?'Admin':'Técnico'}</span>
                        <div style="display:flex;gap:4px;">
                            ${esAdmin() ? `<button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button>
                            <button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button>` : ''}
                        </div>
                    </div>
                </div>
                <div style="margin-bottom:4px;">${esps.map(e=>`<span class="esp-chip">${e}</span>`).join('')}</div>
                <div style="font-size:0.72rem;color:var(--muted);">📍 ${t.region||'Sin región asignada'}</div>
                <div style="margin-top:8px;">
                    <button class="btn btn-blue btn-sm btn-full" onclick="abrirLogin('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button>
                </div>
            </div>`;
        }).join('')}

        ${esAdmin() ? `
        <!-- SECCIÓN JMC TIENDAS - SOLO ADMIN -->
        <div style="margin-top:1.2rem;background:white;border:0.5px solid var(--border);border-radius:12px;overflow:hidden;">
            <div style="background:#1e3a6e;padding:0.7rem 1rem;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:0.88rem;font-weight:700;color:white;">🏪 Tiendas Jerónimo Martins</div>
                    <div style="font-size:0.68rem;color:#93c5fd;margin-top:2px;">Tabla activa: ${JMC_TIENDAS_VERSION}</div>
                </div>
                <span style="background:#c9a227;color:#1e3a6e;font-size:0.65rem;font-weight:700;padding:2px 7px;border-radius:3px;">${JMC_TIENDAS.length} tiendas</span>
            </div>
            <div style="padding:0.85rem;">
                <div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.65rem;">
                    Al subir un nuevo CSV las tiendas se actualizan. Los registros históricos conservan los datos del coordinador que estaba activo en ese momento.
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <label class="btn btn-blue btn-sm" style="cursor:pointer;min-height:38px;display:inline-flex;align-items:center;">
                        📥 Subir CSV actualizado
                        <input type="file" accept=".csv" style="display:none;" onchange="subirCSVJMC(this)">
                    </label>
                    <button class="btn btn-gray btn-sm" onclick="descargarPlantillaCSV()">📄 Descargar plantilla</button>
                </div>
                ${JMC_TIENDAS.length > 0 ? `
                <div style="margin-top:0.75rem;font-size:0.75rem;font-weight:700;color:var(--text);margin-bottom:4px;">Tiendas cargadas (${JMC_TIENDAS.length})</div>
                <div style="overflow-x:auto;border-radius:8px;border:0.5px solid var(--border);">
                    <table style="width:100%;border-collapse:collapse;font-size:0.68rem;">
                        <thead>
                            <tr style="background:var(--bg2);">
                                <th style="padding:5px 8px;text-align:left;color:var(--hint);font-weight:600;border-bottom:0.5px solid var(--border);">SAP</th>
                                <th style="padding:5px 8px;text-align:left;color:var(--hint);font-weight:600;border-bottom:0.5px solid var(--border);">Tienda</th>
                                <th style="padding:5px 8px;text-align:left;color:var(--hint);font-weight:600;border-bottom:0.5px solid var(--border);">Ciudad</th>
                                <th style="padding:5px 8px;text-align:left;color:var(--hint);font-weight:600;border-bottom:0.5px solid var(--border);">Coordinador</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${JMC_TIENDAS.map(t=>`<tr style="border-bottom:0.5px solid var(--bg2);">
                                <td style="padding:4px 8px;font-weight:700;color:var(--green);">${t.sap}</td>
                                <td style="padding:4px 8px;color:#334155;">${t.tienda}</td>
                                <td style="padding:4px 8px;color:var(--muted);">${t.ciudad}</td>
                                <td style="padding:4px 8px;color:var(--muted);">${t.coordinador}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
            </div>
        </div>` : ''}
    </div>`;
}

function abrirLogin(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal" onclick="event.stopPropagation()" style="max-width:320px;">
        <div class="modal-h"><h3>🔑 Ingresar</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b" style="text-align:center;">
            <div style="font-size:0.95rem;font-weight:700;margin-bottom:2px;">${t.nombre}</div>
            <div style="font-size:0.78rem;color:var(--hint);margin-bottom:12px;">${t.tipoDoc} · ${t.cedula}</div>
            <label class="fl first" style="text-align:left;">Cédula</label>
            <input class="fi" id="mlCedula" placeholder="Ingresa tu cédula" type="number" style="margin-bottom:8px;">
            <label class="fl" style="text-align:left;">Clave (4 dígitos)</label>
            <div class="pin-display" id="mlPinDisplay" style="margin:8px 0;">
                <div class="pin-digit active" id="mlpd0"></div>
                <div class="pin-digit" id="mlpd1"></div>
                <div class="pin-digit" id="mlpd2"></div>
                <div class="pin-digit" id="mlpd3"></div>
            </div>
            <div class="numpad" style="gap:6px;">
                ${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="num-btn" onclick="mlPin('${tid}',${n})">${n}</div>`).join('')}
                <div class="num-btn del" onclick="mlDel()">⌫</div>
                <div class="num-btn zero" onclick="mlPin('${tid}',0)">0</div>
                <div class="num-btn ok" onclick="mlLogin('${tid}')">✓</div>
            </div>
            <div id="mlMsg" style="margin-top:8px;"></div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="mlLogin('${tid}')">Ingresar</button>
            </div>
        </div>
    </div>`);
    window._mlPin = '';
}

function mlPin(tid, n) {
    if ((window._mlPin||'').length >= 4) return;
    window._mlPin = (window._mlPin||'') + String(n);
    mlUpdateDisplay();
    if (window._mlPin.length === 4) mlLogin(tid);
}
function mlDel() { window._mlPin = (window._mlPin||'').slice(0,-1); mlUpdateDisplay(); }
function mlUpdateDisplay() {
    for (let i=0;i<4;i++) {
        const d = document.getElementById('mlpd'+i);
        if (!d) return;
        d.className='pin-digit';
        if (i<window._mlPin.length){ d.textContent='●'; d.classList.add('filled'); }
        else if (i===window._mlPin.length){ d.textContent='_'; d.classList.add('active'); }
        else { d.textContent=''; }
    }
}
function mlLogin(tid) {
    const t = getTec(tid);
    const pin = window._mlPin||'';
    const cedula = document.getElementById('mlCedula')?.value?.trim();
    const msg = document.getElementById('mlMsg');
    if (!cedula) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Ingresa tu cédula</div>'; return; }
    if (pin.length<4) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Ingresa los 4 dígitos</div>'; return; }
    if (t.cedula !== cedula || t.clave !== pin) {
        if(msg) msg.innerHTML='<div class="login-error">❌ Cédula o clave incorrecta</div>';
        window._mlPin=''; mlUpdateDisplay(); return;
    }
    sesionActual = t;
    window._mlPin='';
    closeModal();
    actualizarTopbar();
    currentView='panel';
    renderView();
    toast(`✅ Bienvenido, ${t.nombre.split(' ')[0]}`);
}

// ===== MODAL RECORDAR WHATSAPP =====
function modalRecordar(clienteId, equipoId, fecha) {
    const e = getEq(equipoId);
    const c = getCl(clienteId);
    const fechaF = fmtFechaLarga(fecha);
    const esJMC = esClienteJMC(clienteId);
    let tel, destinatario, msg;
    if (esJMC) {
        const sap = e?.ubicacion;
        const tienda = getTiendaJMC(sap);
        if (tienda) {
            tel = tienda.telefono;
            destinatario = `${tienda.coordinador} · SAP ${sap}`;
            msg = `Hola *${tienda.coordinador}*, le recordamos que el activo *${e?.marca} ${e?.modelo}* de la tienda *${tienda.tienda} (SAP ${sap})* tiene programado un mantenimiento para el *${fechaF}*. Por favor confirmarnos si podemos agendar la visita técnica. Gracias — OLM Ingeniería SAS · Bogotá 📞 311 4831801`;
        } else {
            tel = c?.telefono;
            destinatario = c?.nombre;
            msg = `Hola *${c?.nombre}*, le recordamos que el activo *${e?.marca} ${e?.modelo}* ubicado en *${e?.ubicacion}* tiene programado un mantenimiento para el *${fechaF}*. Por favor confirmarnos. Gracias — OLM Ingeniería SAS · Bogotá 📞 311 4831801`;
        }
    } else {
        tel = c?.telefono;
        destinatario = c?.nombre;
        msg = `Hola *${c?.nombre}*, le recordamos que su activo *${e?.marca} ${e?.modelo}* ubicado en *${e?.ubicacion}* tiene programado un mantenimiento para el *${fechaF}*. Por favor confirmarnos si podemos agendar la visita técnica. Gracias — OLM Ingeniería SAS · Bogotá 📞 311 4831801`;
    }
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>📱 Recordatorio WhatsApp</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="font-size:0.82rem;color:var(--muted);margin-bottom:0.6rem;">Para <strong>${destinatario}</strong> · 📞 ${tel}</div>
            <div class="wa-bubble">${msg}</div>
            <div style="font-size:0.75rem;color:var(--hint);margin-bottom:0.5rem;">Editar antes de enviar:</div>
            <textarea class="fi" id="waMsgEdit" rows="5">${msg}</textarea>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-wa" onclick="enviarWhatsApp('${tel}')">📱 Abrir WhatsApp</button>
            </div>
        </div>
    </div>`);
}
function enviarWhatsApp(tel) {
    const msg = document.getElementById('waMsgEdit')?.value||'';
    const telLimpio = '57'+tel.replace(/\D/g,'');
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    closeModal(); toast('📱 WhatsApp abierto');
}

// ===== NUEVO SERVICIO =====
const JMC_ID = 'c3'; // ID de Jerónimo Martins Colombia

// Tabla de tiendas JMC (simulada desde el Excel)
const JMC_TIENDAS = [
    { sap: '893', tienda: 'Villa del Rosario - Lomitas - Lote No 2 Anillo Vial', ciudad: 'Villa del Rosario', departamento: 'Norte de Santander', direccion: 'Anillo Vial No. 12 – 30 Lote 2', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '904', tienda: 'Villa del Rosario - Bellavista (QPRO)', ciudad: 'Villa del Rosario', departamento: 'Norte de Santander', direccion: 'Carrera 7 No. 2-34/42', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '927', tienda: 'Villa del Rosario - La Palmita (QPRO)', ciudad: 'Villa del Rosario', departamento: 'Norte de Santander', direccion: 'Carrera 7 No. 16 - 48', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '947', tienda: 'Pamplona 4 de Julio (QPRO)', ciudad: 'Pamplona', departamento: 'Norte de Santander', direccion: 'Calle 8 No. 7 -102/104', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '1032', tienda: 'Malaga - Centro (QPRO)', ciudad: 'Malaga', departamento: 'Santander', direccion: 'Calle 11 No. 8 - 44', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
];

function getTiendaJMC(sap) {
    return JMC_TIENDAS.find(t => t.sap === String(sap));
}

// Historial versiones JMC para trazabilidad
let JMC_TIENDAS_VERSION = 'Enero 2026 (por defecto)';
let JMC_HISTORIAL_VERSIONES = [];

function subirCSVJMC(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const lines = ev.target.result.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast('⚠️ CSV vacío o inválido'); return; }
        const nuevas = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g,''));
            if (cols.length < 8 || !cols[0]) continue;
            nuevas.push({ sap:cols[0], tienda:cols[1], ciudad:cols[2], departamento:cols[3], direccion:cols[4], coordinador:cols[5], cargo:cols[6], telefono:cols[7] });
        }
        if (!nuevas.length) { toast('⚠️ No se encontraron tiendas válidas'); return; }
        const fechaActual = new Date().toISOString().split('T')[0];
        // Guardar versión anterior en historial para trazabilidad
        JMC_HISTORIAL_VERSIONES.push({ fecha: fechaActual, version: JMC_TIENDAS_VERSION, tiendas: JSON.parse(JSON.stringify(JMC_TIENDAS)) });
        JMC_TIENDAS.length = 0;
        nuevas.forEach(t => JMC_TIENDAS.push(t));
        JMC_TIENDAS_VERSION = `${file.name.replace('.csv','')} · ${fechaActual}`;
        input.value = '';
        renderView();
        toast(`✅ ${nuevas.length} tiendas cargadas correctamente`);
    };
    reader.readAsText(file, 'UTF-8');
}

function descargarPlantillaCSV() {
    const enc = 'SAP,TIENDA,CIUDAD,DEPARTAMENTO,DIRECCION,COORDINADOR,CARGO,TELEFONO';
    const filas = JMC_TIENDAS.length > 0
        ? JMC_TIENDAS.map(t => [t.sap,t.tienda,t.ciudad,t.departamento,t.direccion,t.coordinador,t.cargo,t.telefono].join(','))
        : ['893,Villa del Rosario - Lomitas,Villa del Rosario,Norte de Santander,Anillo Vial No. 12-30,Leny Grimaldos,Coordinador Sr Mantenimiento,3102102100'];
    const csv = [enc, ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'JMC_Tiendas_Plantilla.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('📄 Plantilla descargada');
}

function esClienteJMC(clienteId) {
    return clienteId === JMC_ID;
}

// ===== MODAL INFORME JMC =====
function modalInformeJMC(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const hoy = new Date().toISOString().split('T')[0];
    const sapActual = e?.ubicacion;
    const tienda = getTiendaJMC(sapActual);
    const dd = hoy.split('-')[2], mm = hoy.split('-')[1], aa = hoy.split('-')[0].slice(2);

    const tiposAsistencia = ['Reparación','Garantía','Ajuste','Modificación','Servicio','Mejora','Combinación'];
    const tiposFalla = ['Mecánicas','Material','Instrumentos','Eléctricas','Influencia Externa'];
    const causas = ['Diseño','Fabricación/Instalación','Operación/Mantenimiento','Administración','Desconocida'];

    showModal(`<div class="modal modal-wide" onclick="event.stopPropagation()">
        <div class="modal-h" style="background:#1e3a6e;">
            <h3>📋 Informe Jerónimo Martins — FF-JMC-DT-06</h3>
            <button class="xbtn" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">

            <!-- CONTRATISTA -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin-bottom:6px;border-radius:4px;letter-spacing:0.5px;">CONTRATISTA</div>
            <div class="fr">
                <div><label class="fl first">Razón social</label><input class="fi" value="OLM INGENIERÍA SAS" readonly style="background:#f0faf5;font-weight:700;"></div>
                <div><label class="fl first">NIT</label><input class="fi" value="901.050.468-5" readonly style="background:#f0faf5;"></div>
            </div>
            <div class="fr">
                <div><label class="fl">Contacto</label><input class="fi" value="Oscar Leonardo Martínez" readonly style="background:#f0faf5;"></div>
                <div><label class="fl">Teléfono</label><input class="fi" value="311 4831801" readonly style="background:#f0faf5;"></div>
            </div>

            <!-- SOLICITANTE -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin:10px 0 6px;border-radius:4px;letter-spacing:0.5px;">SOLICITANTE Y TIENDA BENEFICIARIA</div>
            <div class="fr">
                <div><label class="fl first">Nombre solicitante</label><input class="fi" id="jNombreSol" value="${tienda?.coordinador||''}" readonly style="background:#f0faf5;font-weight:700;"></div>
                <div><label class="fl first">Cargo</label><input class="fi" id="jCargo" value="${tienda?.cargo||''}" readonly style="background:#f0faf5;"></div>
            </div>
            <div class="fr">
                <div><label class="fl">Nombre tienda</label><input class="fi" id="jTienda" value="${tienda?.tienda||''}" readonly style="background:#f0faf5;font-weight:700;"></div>
                <div><label class="fl">N° Tienda (SAP)</label><input class="fi" id="jSAP" value="${sapActual||''}" readonly style="background:#f0faf5;font-weight:700;"></div>
            </div>
            <div class="fr">
                <div><label class="fl">N° Ticket</label><input class="fi" id="jTicket" placeholder="TK-..."></div>
                <div><label class="fl">Fecha</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">
                        <input class="fi" id="jDD" placeholder="DD" maxlength="2" value="${dd}" style="text-align:center;">
                        <input class="fi" id="jMM" placeholder="MM" maxlength="2" value="${mm}" style="text-align:center;">
                        <input class="fi" id="jAA" placeholder="AA" maxlength="2" value="${aa}" style="text-align:center;">
                    </div>
                </div>
            </div>
            <div class="fr">
                <div><label class="fl">Municipio</label><input class="fi" id="jMunicipio" value="${tienda?.ciudad||''}" readonly style="background:#f0faf5;"></div>
                <div><label class="fl">Departamento</label><input class="fi" id="jDepartamento" value="${tienda?.departamento||''}" readonly style="background:#f0faf5;"></div>
            </div>

            <!-- ÁREA TÉCNICA -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin:10px 0 6px;border-radius:4px;letter-spacing:0.5px;">INFORMACIÓN ÁREA TÉCNICA</div>
            <div class="fr">
                <div><label class="fl first">Nombre del equipo</label><input class="fi" id="jEquipo" value="${e?.modelo||''}" readonly style="background:#f0faf5;font-weight:700;"></div>
                <div><label class="fl first">Marca</label><input class="fi" id="jMarca" value="${e?.marca||''}" readonly style="background:#f0faf5;font-weight:700;"></div>
            </div>
            <div><label class="fl">Serial</label><input class="fi" id="jSerial" value="${e?.serie||''}" readonly style="background:#f0faf5;font-weight:700;"></div>

            <!-- TIPO ASISTENCIA -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin:10px 0 6px;border-radius:4px;letter-spacing:0.5px;">TIPO DE ASISTENCIA</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                ${tiposAsistencia.map(t=>`<label style="display:flex;align-items:center;gap:4px;font-size:0.78rem;cursor:pointer;">
                    <input type="radio" name="jTipoAsi" value="${t}" ${t==='Reparación'?'checked':''}> ${t}
                </label>`).join('')}
            </div>

            <!-- TIPO FALLA -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin:10px 0 6px;border-radius:4px;letter-spacing:0.5px;">TIPO DE FALLA</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                ${tiposFalla.map(t=>`<label style="display:flex;align-items:center;gap:4px;font-size:0.78rem;cursor:pointer;">
                    <input type="radio" name="jTipoFalla" value="${t}"> ${t}
                </label>`).join('')}
            </div>

            <!-- CAUSA -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin:10px 0 6px;border-radius:4px;letter-spacing:0.5px;">CAUSA DE FALLAS BÁSICAS</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
                ${causas.map(t=>`<label style="display:flex;align-items:center;gap:4px;font-size:0.78rem;cursor:pointer;">
                    <input type="radio" name="jCausa" value="${t}"> ${t}
                </label>`).join('')}
            </div>

            <!-- TEXTOS -->
            <label class="fl">Descripción de la falla (funcionario tienda)</label>
            <textarea class="fi" id="jDescFalla" rows="2" placeholder="Descripción..."></textarea>
            <label class="fl">Diagnóstico del técnico</label>
            <textarea class="fi" id="jDiag" rows="3" placeholder="Diagnóstico..."></textarea>
            <label class="fl">Repuestos cambiados</label>
            <textarea class="fi" id="jRepuestos" rows="2" placeholder="Repuestos..."></textarea>
            <label class="fl">Observaciones</label>
            <textarea class="fi" id="jObs" rows="2" placeholder="Observaciones..."></textarea>

            <!-- EVALUACIÓN -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin:10px 0 6px;border-radius:4px;letter-spacing:0.5px;">EVALUACIÓN DEL SERVICIO</div>
            ${[
                ['SEGURIDAD','Labor genera riesgo de accidentalidad para clientes y/o colaboradores'],
                ['SEGURIDAD','Labor ofrece algún riesgo para la integridad del equipo'],
                ['FUNCIONAMIENTO','La falla reportada fue solucionada con el trabajo realizado'],
                ['FUNCIONAMIENTO','Para operar el equipo se siguen los pasos normales de manejo anteriores a la asistencia'],
                ['CALIDAD','La calidad del trabajo está acorde a la requerida por el personal o el equipo'],
                ['LIMPIEZA Y ORGANIZACIÓN','El equipo/área intervenida se dejó armada y organizada como se encontraba'],
                ['LIMPIEZA Y ORGANIZACIÓN','Los escombros y suciedad generada por el técnico fue aseada'],
                ['CAPACITACIÓN','Se indicó la causa de la novedad al personal que recibió el trabajo'],
                ['CAPACITACIÓN','Se indicó cómo prevenir que el problema se vuelva a presentar'],
                ['CAPACITACIÓN','Se indicó cómo actuar en caso de que el problema se vuelva a presentar'],
            ].map((item,i)=>`
            <div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:4px;padding:4px 0;border-bottom:0.5px solid var(--border);">
                <span style="font-size:0.72rem;color:#334155;">${item[1]}</span>
                <label style="display:flex;align-items:center;gap:2px;font-size:0.7rem;font-weight:700;color:var(--green);white-space:nowrap;">
                    <input type="radio" name="jChk${i}" value="cumple" checked> CUMPLE
                </label>
                <label style="display:flex;align-items:center;gap:2px;font-size:0.7rem;font-weight:700;color:var(--red);white-space:nowrap;">
                    <input type="radio" name="jChk${i}" value="nocumple"> NO CUMPLE
                </label>
            </div>`).join('')}

            <!-- CONSTANCIA -->
            <div style="background:#0d4a3a;color:white;text-align:center;font-size:0.72rem;font-weight:700;padding:4px;margin:10px 0 6px;border-radius:4px;letter-spacing:0.5px;">CONSTANCIA DE REALIZACIÓN</div>
            <div class="fr">
                <div><label class="fl first">Técnico encargado</label><input class="fi" value="${sesionActual?.nombre||''}" readonly style="background:#f0faf5;"></div>
                <div><label class="fl first">Cédula</label><input class="fi" value="${sesionActual?.cedula||''}" readonly style="background:#f0faf5;"></div>
            </div>
            <div class="fr">
                <div><label class="fl">Hora entrada</label><input class="fi" type="text" id="jHEntrada" placeholder="HH:MM" maxlength="5" pattern="[0-9]{2}:[0-9]{2}"></div>
                <div><label class="fl">Hora salida</label><input class="fi" type="text" id="jHSalida" placeholder="HH:MM" maxlength="5" pattern="[0-9]{2}:[0-9]{2}"></div>
            </div>
            <div class="fr">
                <div><label class="fl">Nombre funcionario tienda</label><input class="fi" id="jFuncNombre" placeholder="Nombre..."></div>
                <div><label class="fl">Cédula</label><input class="fi" id="jFuncCedula" placeholder="CC..."></div>
            </div>
            <div class="fr">
                <div><label class="fl">Cargo</label><input class="fi" id="jFuncCargo" placeholder="Cargo..."></div>
                <div><label class="fl">SAP</label><input class="fi" id="jFuncSAP" placeholder="SAP..."></div>
            </div>
            <label class="fl">Firma funcionario tienda (con el dedo)</label>
            <canvas id="jFirmaCanvas" width="300" height="80"
                style="width:100%;height:80px;border:1.5px dashed var(--green);border-radius:8px;background:#f0faf5;touch-action:none;cursor:crosshair;display:block;">
            </canvas>
            <button class="btn btn-gray btn-sm" style="margin-top:4px;" onclick="limpiarFirmaJMC()">🗑 Limpiar firma</button>

            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="exportarInformeJMC('${eid}')">📄 Exportar PDF</button>
            </div>
        </div>
    </div>`);

    // Inicializar canvas firma
    setTimeout(() => iniciarFirmaCanvas('jFirmaCanvas'), 100);
}

function iniciarFirmaCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    let drawing = false, lastX = 0, lastY = 0;

    function getPos(ev) {
        const r = canvas.getBoundingClientRect();
        const src = ev.touches ? ev.touches[0] : ev;
        return [src.clientX - r.left, src.clientY - r.top];
    }
    canvas.addEventListener('mousedown',  e => { drawing=true; [lastX,lastY]=getPos(e); });
    canvas.addEventListener('mousemove',  e => { if(!drawing) return; const [x,y]=getPos(e); ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.strokeStyle='#1a1a6e'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke(); [lastX,lastY]=[x,y]; });
    canvas.addEventListener('mouseup',    () => drawing=false);
    canvas.addEventListener('mouseleave', () => drawing=false);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing=true; [lastX,lastY]=getPos(e); }, {passive:false});
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); if(!drawing) return; const [x,y]=getPos(e); ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.strokeStyle='#1a1a6e'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke(); [lastX,lastY]=[x,y]; }, {passive:false});
    canvas.addEventListener('touchend',   () => drawing=false);
}

function limpiarFirmaJMC() {
    const canvas = document.getElementById('jFirmaCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
}

function exportarInformeJMC(eid) {
    const e = getEq(eid);
    const canvas = document.getElementById('jFirmaCanvas');
    const firmaDataUrl = canvas ? canvas.toDataURL('image/png') : '';
    const getRadio = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
    const checks = Array.from({length:10}, (_,i) => getRadio(`jChk${i}`) !== 'nocumple');

    const ticket  = document.getElementById('jTicket')?.value || '';
    const sap     = document.getElementById('jSAP')?.value || '';
    const dd      = document.getElementById('jDD')?.value || '';
    const mm      = document.getElementById('jMM')?.value || '';
    const aa      = document.getElementById('jAA')?.value || '';
    const fechaArch = dd&&mm&&aa ? `${dd}-${mm}-${aa}` : new Date().toISOString().split('T')[0];
    const nombreArch = `TK_${ticket||'sin-ticket'}_SAP_${sap||'sin-sap'}_${fechaArch}`;

    const araB64 = 'data:image/png;base64,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';
    const jmB64  = 'data:image/png;base64,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';

    const mkCb = ok => `<span style="display:inline-block;width:9px;height:9px;border:1px solid #333;background:${ok?'#000':'#fff'};"></span>`;

    // checkRow: si rowspan>0 incluye celda categoria, si 0 no la incluye
    const checkRow = (cat, label, cumple, rs) =>
        `<tr>
            ${rs > 0 ? `<td style="font-style:italic;font-weight:700;font-size:7.5px;border:1px solid #555;padding:2px 4px;vertical-align:middle;" rowspan="${rs}">${cat}</td>` : ''}
            <td style="border:1px solid #555;padding:2px 4px;font-size:7.5px;">${label}</td>
            <td style="text-align:center;border:1px solid #555;font-size:10px;font-weight:700;color:${cumple?'#000':'#bbb'};">${cumple?'X':''}</td>
            <td style="text-align:center;border:1px solid #555;font-size:10px;font-weight:700;color:${!cumple?'#000':'#bbb'};">${!cumple?'X':''}</td>
        </tr>`;

    // Filas vacías para campos de texto (replica el original)
    const emptyRows = n => Array(n).fill('<tr style="height:14px;"><td style="border:1px solid #555;border-top:none;"></td></tr>').join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${nombreArch}</title>
<style>
@page{size:A4 portrait;margin:0.4cm 0.6cm}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:Arial,sans-serif;font-size:9.5px;color:#000;background:white;}
.sec{background:#bfbfbf !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:center;font-weight:700;font-size:8px;padding:2px 4px;letter-spacing:0.5px;border:1px solid #555;margin:2px 0 0;}
table{width:100%;border-collapse:collapse;}
td,th{border:1px solid #555;padding:2px 4px;font-size:9px;vertical-align:top;}
.lbl{color:#555;font-size:6.5px;display:block;}
.val{font-weight:700;font-size:8px;}
.rrow{display:flex;flex-wrap:wrap;gap:10px;padding:3px 8px;border:1px solid #555;border-top:none;align-items:center;}
.ri{display:flex;align-items:center;gap:3px;font-size:7.5px;}
.tbl1{border:1px solid #555;border-top:none;margin-bottom:0;}
.tbl1 td{border:none;border-bottom:1px solid #555;}
</style></head><body>

<!-- HEADER -->
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;padding-bottom:3px;border-bottom:1px solid #999;">
    <img src="${araB64}" style="height:38px;object-fit:contain;">
    <div style="text-align:center;">
        <div style="font-size:13px;font-weight:700;">JERÓNIMO MARTINS COLOMBIA</div>
        <div style="font-size:8px;font-weight:700;color:#333;margin-top:1px;">FORMATO ÚNICO DE SOPORTE — FF-JMC-DT-06</div>
    </div>
    <div style="text-align:right;">
        <img src="${jmB64}" style="height:34px;object-fit:contain;display:block;margin-bottom:1px;">
        <div style="font-size:7.5px;font-weight:700;color:#555;">ANEXO 3</div>
    </div>
</div>

<!-- CONTRATISTA -->
<div class="sec">CONTRATISTA</div>
<table style="border:1px solid #555;border-top:none;margin-bottom:2px;">
<tr>
    <td style="width:30%"><span class="lbl">Razón social</span><span class="val">OLM INGENIERÍA SAS</span></td>
    <td style="width:18%"><span class="lbl">N° NIT</span><span class="val">901.050.468-5</span></td>
    <td style="width:34%"><span class="lbl">Contacto</span><span class="val">Oscar Leonardo Martínez</span></td>
    <td style="width:18%"><span class="lbl">Teléfono</span><span class="val">311 4831801</span></td>
</tr>
</table>

<!-- SOLICITANTE -->
<div class="sec">SOLICITANTE Y TIENDA BENEFICIARIA</div>
<table style="border:1px solid #555;border-top:none;margin-bottom:2px;">
<tr>
    <td style="width:50%"><span class="lbl">Nombre del solicitante</span><span class="val">${document.getElementById('jNombreSol')?.value||''}</span></td>
    <td colspan="3"><span class="lbl">Cargo</span>${document.getElementById('jCargo')?.value||''}</td>
</tr>
<tr>
    <td><span class="lbl">Nombre de la tienda</span><span class="val">${document.getElementById('jTienda')?.value||''}</span></td>
    <td style="width:10%"><span class="lbl">N° Tienda</span><span class="val">${sap}</span></td>
    <td style="width:18%;background:#bfbfbf !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;vertical-align:middle;">
        <div style="font-size:6.5px;font-weight:700;text-align:center;">N° TICKET:</div>
        <div style="font-size:13px;font-weight:700;text-align:center;color:#c62828;">${ticket}</div>
    </td>
    <td style="width:18%;padding:0;" rowspan="2">
        <div style="padding:2px 4px;border-bottom:1px solid #555;">
            <span class="lbl">Fecha</span>
            <span class="val" style="font-size:9px;">${dd}/${mm}/${aa}</span>
        </div>
        <div style="padding:2px 4px;">&nbsp;</div>
    </td>
</tr>
<tr>
    <td><span class="lbl">Municipio</span>${document.getElementById('jMunicipio')?.value||''}</td>
    <td colspan="2"><span class="lbl">Departamento</span>${document.getElementById('jDepartamento')?.value||''}</td>
</tr>
</table>

<!-- ÁREA TÉCNICA -->
<div class="sec">INFORMACIÓN ÁREA TÉCNICA</div>
<table style="border:1px solid #555;border-top:none;margin-bottom:2px;">
<tr>
    <td style="width:35%"><span class="lbl">Nombre del equipo</span><span class="val">${document.getElementById('jEquipo')?.value||''}</span></td>
    <td style="width:30%"><span class="lbl">Marca</span><span class="val">${document.getElementById('jMarca')?.value||''}</span></td>
    <td style="width:35%"><span class="lbl">Serial</span><span class="val">${document.getElementById('jSerial')?.value||''}</span></td>
</tr>
</table>

<!-- TIPO ASISTENCIA -->
<div class="sec">TIPO DE ASISTENCIA</div>
<div class="rrow">
    ${['Reparación','Garantía','Ajuste','Modificación','Servicio','Mejora','Combinación'].map(t=>`<div class="ri">${mkCb(getRadio('jTipoAsi')===t)} ${t}</div>`).join('')}
</div>

<!-- TIPO FALLA -->
<div class="sec" style="margin-top:2px;">TIPO DE FALLA</div>
<div class="rrow">
    ${['Mecánicas','Material','Instrumentos','Eléctricas','Influencia Externa'].map(t=>`<div class="ri">${mkCb(getRadio('jTipoFalla')===t)} ${t}</div>`).join('')}
</div>

<!-- CAUSA -->
<div class="sec" style="margin-top:2px;">CAUSA DE FALLAS BÁSICAS</div>
<div class="rrow">
    ${['Diseño','Fabricación/Instalación','Operación/Mantenimiento','Administración','Desconocida'].map(t=>`<div class="ri">${mkCb(getRadio('jCausa')===t)} ${t}</div>`).join('')}
</div>

<!-- CAMPOS TEXTO — estructura de filas como el original -->
<table class="tbl1" style="margin-top:2px;">
<tr><td style="border:1px solid #555;"><strong>Descripción de la falla funcionario tienda:</strong></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;font-size:8px;">${document.getElementById('jDescFalla')?.value||''}</td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
</table>
<table class="tbl1" style="margin-top:2px;">
<tr><td style="border:1px solid #555;"><strong>Diagnóstico del técnico:</strong></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;font-size:8px;">${document.getElementById('jDiag')?.value||''}</td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
</table>
<table class="tbl1" style="margin-top:2px;">
<tr><td style="border:1px solid #555;"><strong>Repuestos cambiados:</strong></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;font-size:8px;">${document.getElementById('jRepuestos')?.value||''}</td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
</table>
<table class="tbl1" style="margin-top:2px;">
<tr><td style="border:1px solid #555;"><strong>Observaciones:</strong></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;font-size:8px;">${document.getElementById('jObs')?.value||''}</td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
<tr style="height:13px;"><td style="border:1px solid #555;border-top:none;"></td></tr>
</table>

<!-- EVALUACIÓN -->
<div class="sec" style="margin-top:2px;">EVALUACIÓN DEL SERVICIO</div>
<table style="border:1px solid #555;border-top:none;">
<thead>
    <tr style="background:#bfbfbf !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <th style="width:90px;text-align:center;font-size:7.5px;" colspan="2">PARÁMETROS DE EVALUACIÓN</th>
        <th style="width:48px;text-align:center;font-size:7.5px;">CUMPLE</th>
        <th style="width:58px;text-align:center;font-size:7.5px;">NO CUMPLE</th>
    </tr>
</thead>
<tbody>
${checkRow('SEGURIDAD','La labor realizada genera una alta riesgo de accidentalidad para los clientes y/o colaboradores ( de ser asi marque no cumple )',checks[0],2)}
${checkRow('','La labor realizada ofrece algún riesgo para la integridad del equipo ( de ser asi marque no cumple )',checks[1],0)}
${checkRow('FUNCIONAMIENTO','La falla reportada fue solucionada con el trabajo realizado',checks[2],2)}
${checkRow('','Para operar y/o asear el equipo o área intervenida se siguen los pasos normales de manejo anteriores a la asistencia (si debe realizar un procedimiento extra al normal, marque no cumple)',checks[3],0)}
${checkRow('CALIDAD','La calidad del trabajo esta de acuerdo a la requerida por el personal o el equipo',checks[4],1)}
${checkRow('LIMPIEZA Y ORGANIZACIÓN','El equipo o área intervenida se dejo armado y/o organizado como se encontraba en un inicio',checks[5],2)}
${checkRow('','Los escombros y suciedad generada por el técnico fue aseado',checks[6],0)}
${checkRow('CAPACITACION','Se indico la causa de la novedad al personal que recibió el trabajo',checks[7],3)}
${checkRow('','Se indico como prevenir que el problema se vuelva a presentar',checks[8],0)}
${checkRow('','Se indico como actuar en caso de que el problema se vuelva a presentar',checks[9],0)}
</tbody>
</table>

<!-- CONSTANCIA -->
<div class="sec" style="margin-top:2px;">CONSTANCIA REALIZACION ASISTENCIA</div>
<table style="border:1px solid #555;border-top:none;">
<thead>
    <tr>
        <th style="width:17%">Contratistas</th>
        <th style="width:11%">Cédula</th>
        <th style="width:12%">Hora de entrada</th>
        <th style="width:11%">Hora de salida</th>
        <th style="width:12%">Datos</th>
        <th style="width:37%">Funcionario de la tienda</th>
    </tr>
</thead>
<tbody>
<tr>
    <td style="font-size:9.5px;vertical-align:top;">${sesionActual?.nombre||''}</td>
    <td style="font-size:9.5px;vertical-align:top;">${sesionActual?.cedula||''}</td>
    <td style="font-size:9.5px;vertical-align:top;">${document.getElementById('jHEntrada')?.value||''}</td>
    <td style="font-size:9.5px;vertical-align:top;">${document.getElementById('jHSalida')?.value||''}</td>
    <td style="font-size:7.5px;vertical-align:top;">Nombre:</td>
    <td style="font-size:9.5px;vertical-align:top;">${document.getElementById('jFuncNombre')?.value||''}</td>
</tr>
<tr>
    <td style="font-size:9.5px;"></td>
    <td></td><td></td><td></td>
    <td style="font-size:7.5px;">Cedula:</td>
    <td style="font-size:9.5px;">${document.getElementById('jFuncCedula')?.value||''}</td>
</tr>
<tr>
    <td style="font-size:9.5px;"></td>
    <td></td><td></td><td></td>
    <td style="font-size:7.5px;">Cargo:</td>
    <td style="font-size:9.5px;">${document.getElementById('jFuncCargo')?.value||''}</td>
</tr>
<tr>
    <td style="font-size:9.5px;"></td>
    <td></td><td></td><td></td>
    <td style="font-size:7.5px;">SAP:</td>
    <td style="font-size:9.5px;">${document.getElementById('jFuncSAP')?.value||''}</td>
</tr>
<tr>
    <td colspan="2" style="height:52px;vertical-align:top;font-size:7.5px;">
        <strong>Firma Técnico Encargado:</strong><br><br>${sesionActual?.nombre||''}
    </td>
    <td colspan="2" style="height:52px;vertical-align:top;font-size:7.5px;">
        <strong>Cargo:</strong>
    </td>
    <td colspan="2" style="height:52px;vertical-align:top;font-size:7.5px;">
        <strong>Firma:</strong><br>
        ${firmaDataUrl ? `<img src="${firmaDataUrl}" style="max-height:42px;max-width:170px;margin-top:3px;">` : ''}
    </td>
</tr>
</tbody>
</table>

<script>
document.title = '${nombreArch}';
window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 600); });
</script>
</body></html>`;

    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const blobUrl = URL.createObjectURL(blob);
    const v = window.open(blobUrl, '_blank');
    if (!v) {
        const a = document.createElement('a');
        a.href = blobUrl; a.download = nombreArch+'.html'; a.click();
        toast('Descargando...'); return;
    }
    toast('Nombre: ' + nombreArch + '.pdf');
}

function modalNuevoServicio(eid) {
    if (!sesionActual) { toast('🔑 Inicia sesión para continuar'); return; }
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const hoy = new Date().toISOString().split('T')[0];
    const esJMC = esClienteJMC(e?.clienteId);
    fotosNuevas[0]=fotosNuevas[1]=fotosNuevas[2]=null;

    // Extraer SAP de la ubicación si es JMC
    const sapActual = esJMC ? e?.ubicacion : null;
    const tiendaJMC = sapActual ? getTiendaJMC(sapActual) : null;

    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="font-size:0.82rem;color:var(--hint);margin-bottom:0.65rem;background:var(--bg2);padding:0.55rem;border-radius:8px;">
                ${c?.nombre}<br><span style="font-size:0.75rem;">${e?.marca} ${e?.modelo} · 📍 ${e?.ubicacion}</span>
                ${tiendaJMC ? `<br><span style="font-size:0.72rem;color:var(--green);font-weight:600;">🏪 ${tiendaJMC.tienda} · ${tiendaJMC.ciudad}</span>` : ''}
            </div>
            <div class="fr">
                <div><label class="fl first">Tipo *</label>
                    <select class="fi" id="sTipo" onchange="onTipoChange()">
                        <option>Mantenimiento</option><option>Reparación</option><option>Instalación</option>
                    </select>
                </div>
                <div><label class="fl first">Fecha *</label>
                    <input class="fi" type="date" id="sFecha" value="${hoy}">
                </div>
            </div>
            <label class="fl">Técnico</label>
            <input class="fi" id="sTecnico" value="${sesionActual?.nombre||''}" readonly style="background:#f0faf5;">
            ${esJMC ? `
            <div style="background:#f5f3ff;border:0.5px solid #c4b5fd;border-radius:10px;padding:0.65rem;margin-top:0.65rem;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:0.8rem;color:#5b21b6;flex:1;">📋 Informe técnico Jerónimo Martins</span>
                <button class="btn btn-sm" style="background:#7c3aed;color:white;min-height:36px;" onclick="modalInformeJMC('${eid}')">Abrir</button>
            </div>` : ''}
            <label class="fl">Diagnóstico / Descripción *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado, observaciones..."></textarea>
            <div class="mant-box hidden" id="mantBox">
                <label class="fl first">📅 Próximo mantenimiento</label>
                <input class="fi" type="date" id="proxFecha">
            </div>
            <label class="fl" style="margin-top:0.7rem;">📷 Fotos (máx 3)</label>
            <div class="foto-row">
                ${[0,1,2].map(i=>`
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <div class="fslot" id="fslot${i}" onclick="document.getElementById('finput${i}').click()">
                        <div class="fslot-plus">+</div>
                        <div class="fslot-lbl">Foto ${i+1}</div>
                        <input type="file" id="finput${i}" accept="image/*" style="display:none" onchange="previewFoto(this,${i})">
                    </div>
                </div>`).join('')}
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarServicio('${eid}')">💾 Guardar</button>
            </div>
        </div>
    </div>`);
    onTipoChange();
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const box  = document.getElementById('mantBox');
    if (box) box.classList.toggle('hidden', tipo !== 'Mantenimiento');
}

function previewFoto(input, idx) {
    if (!input.files||!input.files[0]) return;
    fotosNuevas[idx] = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const slot = document.getElementById('fslot'+idx);
        if (slot) slot.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">
            <button class="fslot-del" onclick="borrarFoto(event,${idx})">✕</button>
            <input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
    };
    reader.readAsDataURL(input.files[0]);
}

function borrarFoto(e, idx) {
    e.stopPropagation();
    fotosNuevas[idx]=null;
    const slot = document.getElementById('fslot'+idx);
    if (slot) {
        slot.innerHTML=`<div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${idx+1}</div>
            <input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick=()=>document.getElementById('finput'+idx).click();
    }
}

async function guardarServicio(eid) {
    const desc=document.getElementById('sDesc')?.value?.trim();
    if(!desc){toast('⚠️ Ingresa el diagnóstico');return;}
    const tipo=document.getElementById('sTipo').value;
    const fecha=document.getElementById('sFecha').value;
    const prox=tipo==='Mantenimiento'?(document.getElementById('proxFecha')?.value||null):null;
    try{
        await addDoc(collection(db,'servicios'),{equipoId:eid,tipo,fecha,tecnico:sesionActual?.nombre||'',descripcion:desc,proximoMantenimiento:prox,fotos:[]});
        closeModal();await cargarDatos();
        const e=getEq(eid);if(e)goTo('historial',e.clienteId,eid);
        toast('✅ Servicio guardado');
    }catch(err){toast('❌ Error: '+err.message);}
}

function modalEditarServicio(sid) {
    const s = servicios.find(x=>x.id===sid);
    if (!s) return;
    _esidActual=sid; _fotosEditadas=[...(s.fotos||[])];
    fotosNuevas[0]=fotosNuevas[1]=fotosNuevas[2]=null;
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Tipo *</label>
                    <select class="fi" id="esTipo">
                        <option ${s.tipo==='Mantenimiento'?'selected':''}>Mantenimiento</option>
                        <option ${s.tipo==='Reparación'?'selected':''}>Reparación</option>
                        <option ${s.tipo==='Instalación'?'selected':''}>Instalación</option>
                    </select>
                </div>
                <div><label class="fl first">Fecha *</label>
                    <input class="fi" type="date" id="esFecha" value="${s.fecha}">
                </div>
            </div>
            <label class="fl">Diagnóstico *</label>
            <textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea>
            <label class="fl">Próximo mantenimiento</label>
            <input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento||''}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarServicio('${sid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarServicio(sid) {
    const tipo=document.getElementById('esTipo')?.value;
    const fecha=document.getElementById('esFecha')?.value;
    const desc=document.getElementById('esDesc')?.value?.trim();
    const prox=document.getElementById('esProx')?.value||null;
    try{
        await updateDoc(doc(db,'servicios',sid),{tipo,fecha,descripcion:desc||'',proximoMantenimiento:prox});
        closeModal();await cargarDatos();toast('✅ Servicio actualizado');
    }catch(err){toast('❌ Error: '+err.message);}
}

function modalEliminarServicio(sid) {
    const s = servicios.find(x=>x.id===sid);
    if (!s) return;
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Eliminar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="confirm-box"><p>⚠️ ¿Eliminar este servicio del ${fmtFecha(s.fecha)}?</p></div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="eliminarServicio('${sid}')">🗑️ Sí, eliminar</button>
            </div>
        </div>
    </div>`);
}

async function eliminarServicio(sid) {
    if(!confirm('¿Eliminar este servicio?'))return;
    try{await deleteDoc(doc(db,'servicios',sid));await cargarDatos();toast('🗑️ Servicio eliminado');}
    catch(err){toast('❌ Error: '+err.message);}
}

// ===== CRUD CLIENTES =====
function modalNuevoCliente() {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre / Empresa *</label>
            <input class="fi" id="cNombre" placeholder="Ej: Empresa ABC SAS">
            <div class="fr">
                <div><label class="fl">Teléfono *</label><input class="fi" id="cTel" type="tel" placeholder="31XXXXXXXX"></div>
                <div><label class="fl">Email</label><input class="fi" id="cEmail" type="email" placeholder="correo@..."></div>
            </div>
            <label class="fl">Ciudad *</label>
            <select class="fi" id="cCiudad"><option value="">Seleccionar...</option>${CIUDADES.map(ci=>`<option>${ci}</option>`).join('')}</select>
            <label class="fl">Dirección *</label>
            <input class="fi" id="cDir" placeholder="Calle, carrera, barrio">
            <div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:10px;padding:0.65rem;margin-top:0.5rem;">
                <div style="font-size:0.82rem;font-weight:700;margin-bottom:6px;">📍 Ubicación GPS</div>
                <button class="btn btn-blue btn-full" onclick="obtenerGPS()" style="min-height:46px;">Compartir ubicación actual</button>
                <div id="gpsInfo" style="font-size:0.72rem;color:var(--hint);margin-top:4px;"></div>
                <input type="hidden" id="cLat"><input type="hidden" id="cLng">
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarCliente()">Guardar</button>
            </div>
        </div>
    </div>`);
}

function obtenerGPS() {
    const btn = document.querySelector('[onclick="obtenerGPS()"]');
    if (btn) btn.textContent='⏳ Obteniendo...';
    if (!navigator.geolocation) { toast('⚠️ GPS no disponible'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        document.getElementById('cLat').value=lat;
        document.getElementById('cLng').value=lng;
        document.getElementById('gpsInfo').innerHTML=`✅ ${lat}, ${lng} · <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" style="color:var(--green);">Ver mapa</a>`;
        if(btn) btn.textContent='✅ Ubicación guardada';
    }, ()=>{ toast('⚠️ No se pudo obtener GPS'); if(btn) btn.textContent='Compartir ubicación actual'; });
}

async function guardarCliente() {
    const n=document.getElementById('cNombre')?.value?.trim();
    const t=document.getElementById('cTel')?.value?.trim();
    const ci=document.getElementById('cCiudad')?.value;
    const d=document.getElementById('cDir')?.value?.trim();
    if(!n||!t||!ci||!d){toast('⚠️ Complete los campos obligatorios (*)');return;}
    try{
        await addDoc(collection(db,'clientes'),{nombre:n,telefono:t,ciudad:ci,direccion:d,
            email:document.getElementById('cEmail')?.value||'',
            latitud:document.getElementById('cLat')?.value||null,
            longitud:document.getElementById('cLng')?.value||null,
            fechaCreacion:new Date().toISOString().split('T')[0]});
        closeModal();await cargarDatos();toast('✅ Cliente guardado');
    }catch(err){toast('❌ Error: '+err.message);}
}

function modalEditarCliente(cid) {
    const c=getCl(cid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre *</label><input class="fi" id="eNombre" value="${c.nombre}">
            <div class="fr">
                <div><label class="fl">Teléfono *</label><input class="fi" id="eTel" value="${c.telefono}" type="tel"></div>
                <div><label class="fl">Email</label><input class="fi" id="eEmail" value="${c.email||''}"></div>
            </div>
            <label class="fl">Ciudad *</label>
            <select class="fi" id="eCiudad">${CIUDADES.map(ci=>`<option ${ci===c.ciudad?'selected':''}>${ci}</option>`).join('')}</select>
            <label class="fl">Dirección *</label><input class="fi" id="eDir" value="${c.direccion}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarCliente('${cid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarCliente(cid) {
    try{
        await updateDoc(doc(db,'clientes',cid),{
            nombre:document.getElementById('eNombre').value,
            telefono:document.getElementById('eTel').value,
            email:document.getElementById('eEmail').value,
            ciudad:document.getElementById('eCiudad').value,
            direccion:document.getElementById('eDir').value});
        closeModal();await cargarDatos();toast('✅ Cliente actualizado');
    }catch(err){toast('❌ Error: '+err.message);}
}

function modalEliminarCliente(cid) {
    const c=getCl(cid);
    const eqs=getEquiposCliente(cid); const ss=getServiciosCliente(cid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Eliminar cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="confirm-box">
                <p>⚠️ ¿Eliminar <strong>${c.nombre}</strong>?</p>
                <p style="margin-top:5px;">Se eliminarán también <strong>${eqs.length} activo(s)</strong> y <strong>${ss.length} servicio(s)</strong>.</p>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="eliminarCliente('${cid}')">🗑️ Sí, eliminar</button>
            </div>
        </div>
    </div>`);
}

async function eliminarCliente(cid) {
    const eids=getEquiposCliente(cid).map(e=>e.id);
    try{
        await Promise.all([
            ...servicios.filter(s=>eids.includes(s.equipoId)).map(s=>deleteDoc(doc(db,'servicios',s.id))),
            ...eids.map(id=>deleteDoc(doc(db,'equipos',id))),
            deleteDoc(doc(db,'clientes',cid))
        ]);
        closeModal();goTo('clientes');await cargarDatos();toast('🗑️ Cliente eliminado');
    }catch(err){toast('❌ Error: '+err.message);}
}

// ===== CRUD ACTIVOS =====
function modalNuevoEquipo(cid) {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Marca *</label><input class="fi" id="qMarca" placeholder="ABB, Siemens..."></div>
                <div><label class="fl first">Modelo *</label><input class="fi" id="qModelo" placeholder="TX-400..."></div>
            </div>
            <label class="fl">N° de serie</label><input class="fi" id="qSerie" placeholder="Opcional">
            <label class="fl">Ubicación *</label><input class="fi" id="qUbic" placeholder="Ej: Sala eléctrica principal">
            <label class="fl">Tipo de activo</label><input class="fi" id="qTipo" placeholder="Transformador, Planta eléctrica...">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarEquipo('${cid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarEquipo(cid) {
    const m=document.getElementById('qMarca')?.value?.trim();
    const mo=document.getElementById('qModelo')?.value?.trim();
    const se=document.getElementById('qSerie')?.value?.trim();
    const u=document.getElementById('qUbic')?.value?.trim();
    const ti=document.getElementById('qTipo')?.value?.trim();
    if(!m||!mo||!u){toast('⚠️ Complete marca, modelo y ubicación');return;}
    try{
        await addDoc(collection(db,'equipos'),{clienteId:cid,marca:m,modelo:mo,serie:se||'',ubicacion:u,tipo:ti||''});
        closeModal();await cargarDatos();toast('✅ Activo guardado');
    }catch(err){toast('❌ Error: '+err.message);}
}

function modalEditarEquipo(eid) {
    const eq=getEq(eid);
    if(!eq) return;
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Marca *</label><input class="fi" id="eMarca" value="${eq.marca}"></div>
                <div><label class="fl first">Modelo *</label><input class="fi" id="eModelo" value="${eq.modelo}"></div>
            </div>
            <label class="fl">N° de serie</label><input class="fi" id="eSerie" value="${eq.serie||''}">
            <label class="fl">Ubicación *</label><input class="fi" id="eUbic" value="${eq.ubicacion}">
            <label class="fl">Tipo de activo</label><input class="fi" id="eTipoEq" value="${eq.tipo||''}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarEquipo(eid) {
    try{
        await updateDoc(doc(db,'equipos',eid),{
            marca:document.getElementById('eqMarca').value,
            modelo:document.getElementById('eqModelo').value,
            serie:document.getElementById('eqSerie').value,
            ubicacion:document.getElementById('eqUbic').value,
            tipo:document.getElementById('eqTipo').value});
        closeModal();await cargarDatos();toast('✅ Activo actualizado');
    }catch(err){toast('❌ Error: '+err.message);}
}

function modalEliminarEquipo(eid) {
    const eq=getEq(eid);
    if(!eq) return;
    const ss=getServiciosEquipo(eid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Eliminar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="confirm-box">
                <p>⚠️ ¿Eliminar <strong>${eq.marca} ${eq.modelo}</strong>?</p>
                <p style="margin-top:5px;">Se eliminarán también <strong>${ss.length} servicio(s)</strong>.</p>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="eliminarEquipo('${eid}')">🗑️ Sí, eliminar</button>
            </div>
        </div>
    </div>`);
}

async function eliminarEquipo(eid) {
    const eq=getEq(eid);
    try{
        await Promise.all([
            ...servicios.filter(s=>s.equipoId===eid).map(s=>deleteDoc(doc(db,'servicios',s.id))),
            deleteDoc(doc(db,'equipos',eid))
        ]);
        closeModal();await cargarDatos();goTo('detalle',eq?.clienteId||selectedClienteId);toast('🗑️ Activo eliminado');
    }catch(err){toast('❌ Error: '+err.message);}
}

// ===== CRUD TÉCNICOS =====
function modalNuevoTecnico() {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre completo *</label>
            <input class="fi" id="tNombre" placeholder="Nombre Apellido">
            <div class="fr">
                <div><label class="fl">Tipo doc *</label>
                    <select class="fi" id="tTipoDoc">${TIPOS_DOC.map(d=>`<option>${d}</option>`).join('')}</select>
                </div>
                <div><label class="fl">N° documento *</label>
                    <input class="fi" id="tCedula" placeholder="00000000" type="number">
                </div>
            </div>
            <label class="fl">Teléfono *</label><input class="fi" id="tTel" type="tel" placeholder="31XXXXXXXX">
            <label class="fl">Cargo *</label><input class="fi" id="tCargo" placeholder="Técnico de Campo...">
            <label class="fl">Rol *</label>
            <select class="fi" id="tRol"><option value="tecnico">Técnico</option><option value="admin">Admin</option></select>
            <label class="fl">Especialidades *</label>
            <div id="tEspContainer">
                ${ESPECIALIDADES.map(e=>`
                <div class="esp-option" id="esp_${e.id}" onclick="toggleEsp('${e.id}')">
                    <div class="esp-cb" id="ecb_${e.id}"></div>
                    <span class="esp-lbl">${e.label}</span>
                </div>`).join('')}
            </div>
            <label class="fl">Región que atiende</label>
            <input class="fi" id="tRegion" placeholder="Bogotá, Cundinamarca...">
            <div class="fr" style="margin-top:6px;">
                <div><label class="fl first">Clave (4 dígitos) *</label>
                    <input class="fi" id="tClave" type="password" maxlength="4" placeholder="••••">
                </div>
                <div><label class="fl first">Confirmar clave *</label>
                    <input class="fi" id="tClave2" type="password" maxlength="4" placeholder="••••">
                </div>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button>
            </div>
        </div>
    </div>`);
    window._espSel = [];
}

function toggleEsp(id) {
    window._espSel = window._espSel||[];
    const idx = window._espSel.indexOf(id);
    if(idx>=0) window._espSel.splice(idx,1); else window._espSel.push(id);
    const el = document.getElementById('esp_'+id);
    const cb = document.getElementById('ecb_'+id);
    if(el) el.classList.toggle('selected', window._espSel.includes(id));
    if(cb) cb.classList.toggle('on', window._espSel.includes(id));
}

async function guardarTecnico() {
    const n=document.getElementById('tNombre')?.value?.trim();
    const cc=document.getElementById('tCedula')?.value?.trim();
    const cl=document.getElementById('tClave')?.value?.trim();
    const tel=document.getElementById('tTel')?.value?.trim();
    const car=document.getElementById('tCargo')?.value?.trim();
    const rol=document.getElementById('tRol')?.value||'tecnico';
    const reg=document.getElementById('tRegion')?.value?.trim();
    const esps=ESPECIALIDADES.filter((_,i)=>document.getElementById(`tEsp${i}`)?.checked).map(e=>e.id);
    if(!n||!cc||!cl){toast('⚠️ Nombre, cédula y clave obligatorios');return;}
    if(cl.length!==4){toast('⚠️ Clave de 4 dígitos');return;}
    if(tecnicos.find(t=>t.cedula===cc)){toast('⚠️ Cédula ya existe');return;}
    try{
        await addDoc(collection(db,'tecnicos'),{nombre:n,cedula:cc,
            tipoDoc:document.getElementById('tTipoDoc')?.value||'CC',
            telefono:tel||'',cargo:car||'',rol,especialidades:esps,region:reg||'',clave:cl});
        closeModal();await cargarDatos();toast('✅ Técnico guardado');
    }catch(err){toast('❌ Error: '+err.message);}
}

function modalEditarTecnico(tid) {
    const t=getTec(tid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre *</label><input class="fi" id="etNombre" value="${t.nombre}">
            <div class="fr">
                <div><label class="fl">Tipo doc</label>
                    <select class="fi" id="etTipoDoc">${TIPOS_DOC.map(d=>`<option ${d===t.tipoDoc?'selected':''}>${d}</option>`).join('')}</select>
                </div>
                <div><label class="fl">N° documento</label><input class="fi" id="etCedula" value="${t.cedula}"></div>
            </div>
            <label class="fl">Teléfono</label><input class="fi" id="etTel" value="${t.telefono}" type="tel">
            <label class="fl">Cargo</label><input class="fi" id="etCargo" value="${t.cargo||''}">
            <label class="fl">Rol</label>
            <select class="fi" id="etRol"><option value="tecnico" ${t.rol==='tecnico'?'selected':''}>Técnico</option><option value="admin" ${t.rol==='admin'?'selected':''}>Admin</option></select>
            <label class="fl">Especialidades</label>
            <div id="etEspContainer">
                ${ESPECIALIDADES.map(e=>`
                <div class="esp-option ${(t.especialidades||[]).includes(e.id)?'selected':''}" id="etesp_${e.id}" onclick="toggleEspEdit('${e.id}','${tid}')">
                    <div class="esp-cb ${(t.especialidades||[]).includes(e.id)?'on':''}" id="etecb_${e.id}"></div>
                    <span class="esp-lbl">${e.label}</span>
                </div>`).join('')}
            </div>
            <label class="fl">Región</label><input class="fi" id="etRegion" value="${t.region||''}">
            <label class="fl">Nueva clave (dejar vacío para no cambiar)</label>
            <div class="fr">
                <div><input class="fi" id="etClave" type="password" maxlength="4" placeholder="••••"></div>
                <div><input class="fi" id="etClave2" type="password" maxlength="4" placeholder="Confirmar"></div>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarTecnico('${tid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
    window._espSelEdit = [...(t.especialidades||[])];
}

function toggleEspEdit(id) {
    window._espSelEdit = window._espSelEdit||[];
    const idx=window._espSelEdit.indexOf(id);
    if(idx>=0) window._espSelEdit.splice(idx,1); else window._espSelEdit.push(id);
    const el=document.getElementById('etesp_'+id);
    const cb=document.getElementById('etecb_'+id);
    if(el) el.classList.toggle('selected',window._espSelEdit.includes(id));
    if(cb) cb.classList.toggle('on',window._espSelEdit.includes(id));
}

async function actualizarTecnico(tid) {
    const cl=document.getElementById('etClave')?.value?.trim();
    const data={nombre:document.getElementById('etNombre').value,
        telefono:document.getElementById('etTel').value,
        cargo:document.getElementById('etCargo').value,
        rol:document.getElementById('etRol')?.value||'tecnico',
        region:document.getElementById('etRegion').value,
        especialidades:ESPECIALIDADES.filter((_,i)=>document.getElementById(`etEsp${i}`)?.checked).map(e=>e.id)};
    if(cl&&cl.length===4)data.clave=cl;
    try{
        await updateDoc(doc(db,'tecnicos',tid),data);
        closeModal();await cargarDatos();toast('✅ Técnico actualizado');
    }catch(err){toast('❌ Error: '+err.message);}
}

async function eliminarTecnico(tid) {
    if(!confirm('¿Eliminar este técnico?'))return;
    try{await deleteDoc(doc(db,'tecnicos',tid));await cargarDatos();toast('🗑️ Técnico eliminado');}
    catch(err){toast('❌ Error: '+err.message);}
}

// ===== PDF HISTORIAL =====
function generarInformePDF(eid) {
    const e=getEq(eid); const c=getCl(e?.clienteId);
    const ss=getServiciosEquipo(eid).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe_${e?.marca}_${e?.modelo}</title>
<style>
  @page{size:A4;margin:1.5cm 2cm} *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;margin:0}
  .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0d4a3a;padding-bottom:10px;margin-bottom:12px}
  .brand{font-size:1.1rem;font-weight:700;color:#0d4a3a;letter-spacing:1px}
  .brand-sub{font-size:9px;color:#c9a227;font-weight:700}
  .contact{text-align:right;font-size:10px;color:#475569;line-height:1.6}
  .title{font-size:1rem;font-weight:700;color:#0d4a3a;text-align:center;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}
  .info-section{background:#f8fafc;border-radius:6px;padding:10px;margin-bottom:12px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
  .info-item{font-size:11px} .info-item strong{color:#0f172a}
  .servicio{border:0.5px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:12px;page-break-inside:avoid}
  .serv-header{display:flex;justify-content:space-between;margin-bottom:6px}
  .tipo-badge{background:#d1ede0;color:#0d4a3a;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
  .tipo-badge.rep{background:#fee2e2;color:#dc2626} .tipo-badge.inst{background:#dcfce7;color:#16a34a}
  .footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:0.5px solid #e2e8f0;padding-top:6px}
</style></head><body>
  <div class="hdr">
    <div><div class="brand">OLM INGENIERÍA SAS</div><div class="brand-sub">PLANTAS Y SISTEMAS ELÉCTRICOS</div></div>
    <div class="contact">Bogotá · NIT 901.050.468-5<br>📞 311 4831801<br>Oscar Leonardo Martínez</div>
  </div>
  <div class="title">Informe Técnico</div>
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item"><strong>Cliente:</strong> ${c?.nombre||'N/A'}</div>
      <div class="info-item"><strong>Teléfono:</strong> ${c?.telefono||'N/A'}</div>
      <div class="info-item"><strong>Dirección:</strong> ${c?.direccion||'N/A'}</div>
      <div class="info-item"><strong>Ciudad:</strong> ${c?.ciudad||'N/A'}</div>
      <div class="info-item"><strong>Activo:</strong> ${e?.marca||''} ${e?.modelo||''}</div>
      <div class="info-item"><strong>Serie:</strong> ${e?.serie||'N/A'}</div>
      <div class="info-item"><strong>Ubicación:</strong> ${e?.ubicacion||'N/A'}</div>
      <div class="info-item"><strong>Servicios:</strong> ${ss.length}</div>
    </div>
  </div>
  ${ss.map(s=>`<div class="servicio">
    <div class="serv-header">
      <span class="tipo-badge ${s.tipo==='Reparación'?'rep':s.tipo==='Instalación'?'inst':''}">${s.tipo}</span>
      <span style="font-size:11px;color:#64748b;">${fmtFechaLarga(s.fecha)}</span>
    </div>
    <p style="margin:3px 0;font-size:11px;"><strong>Técnico:</strong> ${s.tecnico}</p>
    <p style="margin:3px 0;font-size:11px;"><strong>Descripción:</strong> ${s.descripcion}</p>
    ${s.proximoMantenimiento?`<p style="margin:3px 0;font-size:11px;color:#c9a227;"><strong>📅 Próximo:</strong> ${fmtFechaLarga(s.proximoMantenimiento)}</p>`:''}
  </div>`).join('')}
  <div class="footer">OLM Ingeniería SAS · Sistema de Gestión de Plantas y Sistemas Eléctricos · ${new Date().toLocaleDateString('es-ES')}</div>
</body></html>`;
    const v=window.open('','_blank'); v.document.write(html); v.document.close();
    v.onload = () => { v.focus(); v.print(); };
    setTimeout(() => { try { v.focus(); v.print(); } catch(e){} }, 800);
    toast('🖨️ Selecciona "Guardar como PDF" en la impresora');
}

// ===== QR =====
function modalQR(eid) {
    const e=getEq(eid);
    const c=getCl(e?.clienteId);
    const url=`${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    const qrDiv=document.createElement('div');
    qrDiv.style.cssText='position:fixed;top:-9999px;left:-9999px;width:260px;height:260px;';
    document.body.appendChild(qrDiv);
    const QRLib=window.QRCode;
    if(!QRLib){toast('⚠️ Recarga la página');document.body.removeChild(qrDiv);return;}
    new QRLib(qrDiv,{text:url,width:260,height:260,colorDark:'#0d4a3a',colorLight:'#ffffff',correctLevel:QRLib.CorrectLevel.M});
    setTimeout(()=>{
        const qrCanvas=qrDiv.querySelector('canvas');
        const W=380,H=560;
        const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
        const ctx=cv.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
        // Borde verde
        ctx.strokeStyle='#0d4a3a'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(24,10); ctx.lineTo(W-24,10); ctx.quadraticCurveTo(W-10,10,W-10,24);
        ctx.lineTo(W-10,H-24); ctx.quadraticCurveTo(W-10,H-10,W-24,H-10);
        ctx.lineTo(24,H-10); ctx.quadraticCurveTo(10,H-10,10,H-24);
        ctx.lineTo(10,24); ctx.quadraticCurveTo(10,10,24,10);
        ctx.closePath(); ctx.stroke();
        // Header verde
        ctx.fillStyle='#0d4a3a';
        ctx.beginPath(); ctx.moveTo(W/2-105+8,18); ctx.lineTo(W/2+105-8,18);
        ctx.quadraticCurveTo(W/2+105,18,W/2+105,26);
        ctx.lineTo(W/2+105,76); ctx.lineTo(W/2-105,76);
        ctx.lineTo(W/2-105,26); ctx.quadraticCurveTo(W/2-105,18,W/2-105+8,18);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle='#c9a227'; ctx.font='bold 20px Arial,sans-serif'; ctx.textAlign='center';
        ctx.fillText('OLM INGENIERÍA SAS',W/2,48);
        ctx.fillStyle='#a5c9bb'; ctx.font='10px Arial,sans-serif';
        ctx.fillText('Plantas y Sistemas Eléctricos · Bogotá',W/2,66);
        // Nombre activo
        ctx.fillStyle='#0f172a'; ctx.font='bold 14px Arial,sans-serif';
        ctx.fillText(`${e?.marca||''} ${e?.modelo||''}`,W/2,98);
        ctx.fillStyle='#64748b'; ctx.font='11px Arial,sans-serif';
        ctx.fillText(`📍 ${e?.ubicacion||''}`,W/2,116);
        if(c?.nombre) { ctx.fillStyle='#94a3b8'; ctx.font='10px Arial,sans-serif'; ctx.fillText(`👤 ${c.nombre}`,W/2,132); }
        // QR
        if(qrCanvas) ctx.drawImage(qrCanvas,(W-230)/2,142,230,230);
        // URL
        ctx.fillStyle='#94a3b8'; ctx.font='7px Arial,sans-serif';
        const mid=Math.floor(url.length/2);
        ctx.fillText(url.slice(0,mid),W/2,384); ctx.fillText(url.slice(mid),W/2,394);
        // Línea divisora
        ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(28,406); ctx.lineTo(W-28,406); ctx.stroke();
        // Teléfono grande
        ctx.fillStyle='#0d4a3a'; ctx.font='bold 30px Arial,sans-serif';
        ctx.fillText('311 483 1801',W/2,450);
        ctx.fillStyle='#94a3b8'; ctx.font='10px Arial,sans-serif';
        ctx.fillText('📞 Línea de soporte OLM Ingeniería',W/2,468);
        // Footer
        ctx.fillStyle='#cbd5e1'; ctx.font='8px Arial,sans-serif';
        ctx.fillText('OLM Ingeniería SAS · Sistema de Gestión de Plantas y Sistemas Eléctricos',W/2,520);
        document.body.removeChild(qrDiv);
        const dataUrl=cv.toDataURL('image/png');
        showModal(`<div class="modal" onclick="event.stopPropagation()" style="max-width:340px;">
            <div class="modal-h"><h3>📱 Código QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
            <div class="modal-b" style="text-align:center;">
                <img src="${dataUrl}" style="width:100%;border-radius:8px;margin-bottom:1rem;" alt="QR">
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <a href="${dataUrl}" download="QR_${(e?.marca||'')}_${(e?.modelo||'')}.png" class="btn btn-blue btn-full" style="text-decoration:none;display:block;padding:0.6rem;border-radius:10px;">⬇️ Descargar imagen</a>
                    <button class="btn btn-gray btn-full" onclick="closeModal()">Cerrar</button>
                </div>
            </div>
        </div>`);
    },200);
}

// ===== VISTA PÚBLICA QR =====
function manejarRutaQR() {
    const hash=window.location.hash;
    if(!hash.startsWith('#/equipo/')) return false;
    const eid=hash.replace('#/equipo/','');
    const e=getEq(eid);
    if(!e) return false;
    const c=getCl(e.clienteId);
    const ss=getServiciosEquipo(eid).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    const main=document.getElementById('mainContent');
    const topbar=document.querySelector('.topbar');
    const botnav=document.querySelector('.botnav');
    if(topbar) topbar.style.display='none';
    if(botnav) botnav.style.display='none';
    main.style.background='white';
    main.innerHTML=`<div style="max-width:600px;margin:0 auto;padding:1.5rem;">
        <div style="text-align:center;margin-bottom:1.5rem;">
            <img src="OLM_LOGO.png" style="max-height:65px;max-width:200px;object-fit:contain;margin-bottom:8px;" alt="OLM" onerror="this.parentElement.innerHTML+='<div style=font-size:1.2rem;font-weight:700;color:#0d4a3a;>OLM INGENIERÍA SAS</div>'">
            <div style="font-size:0.72rem;color:#64748b;">Bogotá · 📞 311 4831801</div>
        </div>
        <!-- TELÉFONO GRANDE -->
        <div style="background:#0d4a3a;border-radius:14px;padding:14px;text-align:center;margin-bottom:16px;">
            <div style="font-size:0.78rem;color:#a5c9bb;margin-bottom:4px;">¿Necesitas soporte? Llámanos</div>
            <div style="font-size:2rem;font-weight:700;color:white;letter-spacing:2px;">311 483 1801</div>
            <div style="font-size:0.78rem;color:#c9a227;margin-top:4px;font-weight:600;">OLM Ingeniería SAS · Bogotá</div>
        </div>
        <div style="border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem;margin-bottom:1rem;background:#f8fafc;">
            <div style="font-size:1rem;font-weight:700;">⚡ ${e.marca} ${e.modelo}</div>
            <div style="font-size:0.82rem;color:#475569;margin-top:3px;">📍 ${e.ubicacion}</div>
            <div style="font-size:0.78rem;color:#475569;">👤 ${c?.nombre}</div>
            <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">Serie: ${e.serie||'N/A'}</div>
        </div>
        <div style="margin-bottom:1rem;">
            <button style="width:100%;background:#25D366;color:white;border:none;padding:14px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;"
                onclick="window.open('https://wa.me/573114831801?text=${encodeURIComponent('Hola OLM Ingeniería, soy cliente de ' + (c?.nombre||'') + ' y tengo una novedad con el activo ' + (e?.marca||'') + ' ' + (e?.modelo||'') + ' ubicado en ' + (e?.ubicacion||'') + '. ¿Podrían apoyarme?')}','_blank')">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contactar por WhatsApp
            </button>
        </div>
        <div style="font-size:0.88rem;font-weight:700;margin-bottom:0.75rem;">Historial de servicios (${ss.length})</div>
        ${ss.map(s=>`
        <div style="border:0.5px solid #d1ede0;border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;background:white;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="background:#d1ede0;color:#0d4a3a;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;">${s.tipo}</span>
                <span style="font-size:0.75rem;color:#94a3b8;">${fmtFecha(s.fecha)}</span>
            </div>
            <div style="font-size:0.82rem;color:#475569;">🔧 ${s.tecnico}</div>
            <div style="font-size:0.8rem;color:#64748b;margin-top:2px;">${s.descripcion}</div>
            ${s.proximoMantenimiento?`<div style="font-size:0.75rem;color:#c9a227;margin-top:3px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>`:''}
        </div>`).join('')}
        <div style="text-align:center;font-size:0.7rem;color:#94a3b8;margin-top:1rem;padding-top:0.75rem;border-top:0.5px solid #e2e8f0;">
            OLM Ingeniería SAS · Sistema de Gestión de Plantas y Sistemas Eléctricos
        </div>
    </div>`;
    return true;
}

// ===== EXPORTAR GLOBALS =====
window.goTo=goTo; window.closeModal=closeModal;
window.filtrarClientes=filtrarClientes; window.filtrarEquipos=filtrarEquipos;
window.aplicarFiltros=aplicarFiltros; window.limpiarFiltros=limpiarFiltros;
window.modalNuevoCliente=modalNuevoCliente; window.modalEditarCliente=modalEditarCliente;
window.modalEliminarCliente=modalEliminarCliente; window.guardarCliente=guardarCliente;
window.actualizarCliente=actualizarCliente; window.eliminarCliente=eliminarCliente;
window.modalNuevoEquipo=modalNuevoEquipo; window.guardarEquipo=guardarEquipo;
window.modalEditarEquipo=modalEditarEquipo; window.actualizarEquipo=actualizarEquipo;
window.modalEliminarEquipo=modalEliminarEquipo; window.eliminarEquipo=eliminarEquipo;
window.modalNuevoServicio=modalNuevoServicio; window.guardarServicio=guardarServicio;
window.modalEditarServicio=modalEditarServicio; window.actualizarServicio=actualizarServicio;
window.modalEliminarServicio=modalEliminarServicio; window.eliminarServicio=eliminarServicio;
window.modalNuevoTecnico=modalNuevoTecnico; window.guardarTecnico=guardarTecnico;
window.modalEditarTecnico=modalEditarTecnico; window.actualizarTecnico=actualizarTecnico;
window.eliminarTecnico=eliminarTecnico;
window.modalRecordar=modalRecordar; window.enviarWhatsApp=enviarWhatsApp;
window.modalInformeJMC=modalInformeJMC; window.limpiarFirmaJMC=limpiarFirmaJMC; window.exportarInformeJMC=exportarInformeJMC;
window.subirCSVJMC=subirCSVJMC; window.descargarPlantillaCSV=descargarPlantillaCSV;
window.generarInformePDF=generarInformePDF; window.modalQR=modalQR;
window.obtenerGPS=obtenerGPS; window.previewFoto=previewFoto; window.borrarFoto=borrarFoto;
window.onTipoChange=onTipoChange;
window.doLogin=doLogin; window.pinPress=pinPress; window.pinDel=pinDel; window.resetPin=resetPin;
window.abrirLogin=abrirLogin; window.mlPin=mlPin; window.mlDel=mlDel; window.mlLogin=mlLogin;
window.cerrarSesion=cerrarSesion;
window.toggleEsp=toggleEsp; window.toggleEspEdit=toggleEspEdit;

// ===== BOTTOM NAV =====
document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        // Sin sesión solo panel y tecnicos funcionan
        if (!sesionActual && page !== 'panel' && page !== 'tecnicos') return;
        selectedClienteId = null;
        selectedEquipoId  = null;
        goTo(page);
    });
});

// ===== INICIO =====
window.conectarDrive = conectarDrive;
(async () => {
    await sembrarDatos();
    await cargarDatos();
    if (!manejarRutaQR()) renderView();
})();
