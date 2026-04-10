// ============================================
// OLM INGENIERÍA SAS - APP Firebase
// Versión definitiva: PDF a Drive + CSV persistente
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBpW1ZLMZkpjbsBWiCRA3W15DHO2x-1aTE",
    authDomain: "olmapp.firebaseapp.com",
    projectId: "olmapp",
    storageBucket: "olmapp.firebasestorage.app",
    messagingSenderId: "936967827188",
    appId: "1:936967827188:web:7581731966a851725638a1"
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYWgupeHfhfKmvMDk_FFsTj-P9PdJfXMn3pheGjFMXK7i43AW1V8A5BD4iCSbOho9c/exec';

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ===== DRIVE =====
let _driveConnected = false;

function driveIsConnected() { return _driveConnected; }

async function conectarDriveAuto() {
    try {
        const response = await fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'no-cors' });
        _driveConnected = true;
        console.log('✅ Drive conectado automáticamente');
    } catch (e) {
        console.log('⚠️ Drive no disponible');
        _driveConnected = false;
    }
}

async function driveUploadPDF(html, filename) {
    if (!filename.endsWith('.pdf')) filename = filename.replace('.html', '') + '.pdf';
    
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: html, filename: filename })
        });
        console.log('✅ PDF enviado a Drive:', filename);
        return true;
    } catch(e) {
        console.error('Error Drive:', e);
        return false;
    }
}

// ===== DATOS GLOBALES =====
let clientes = [], equipos = [], servicios = [], tecnicos = [];
let jmcTiendas = [];
let jmcTiendasVersion = '';

// ===== CARGAR DATOS =====
async function cargarDatos() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando...</p></div>';
    try {
        const [cs, es, ss, ts, jmc] = await Promise.all([
            getDocs(query(collection(db, 'clientes'), orderBy('nombre'))),
            getDocs(collection(db, 'equipos')),
            getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc'))),
            getDocs(collection(db, 'tecnicos')),
            getDocs(collection(db, 'jmc_tiendas'))
        ]);
        clientes = cs.docs.map(d => ({ id: d.id, ...d.data() }));
        equipos = es.docs.map(d => ({ id: d.id, ...d.data() }));
        servicios = ss.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos = ts.docs.map(d => ({ id: d.id, ...d.data() }));
        jmcTiendas = jmc.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (jmcTiendas.length > 0 && jmcTiendas[0].version) {
            jmcTiendasVersion = jmcTiendas[0].version;
        }
    } catch (err) {
        console.error('Error:', err);
        toast('⚠️ Error de conexión');
        main.innerHTML = '<div class="page" style="text-align:center;padding:2rem;"><p>⚠️ Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

// ===== SEMBRAR DATOS INICIALES =====
async function sembrarDatos() {
    const snap = await getDocs(collection(db, 'tecnicos'));
    if (!snap.empty) return;
    toast('⚙️ Configurando app...');
    
    const cRef = await addDoc(collection(db, 'clientes'), {
        nombre: 'Jeronimo Martins Colombia',
        telefono: '3212167987',
        email: 'Nestor.gutierres@jeronimo-martins.com',
        ciudad: 'Bogota',
        direccion: 'Calle 100 # 7 - 33, Torre 1, Piso 11',
        latitud: '4.6798976',
        longitud: '-74.0415781',
        fechaCreacion: new Date().toISOString().split('T')[0]
    });
    
    await addDoc(collection(db, 'equipos'), {
        clienteId: cRef.id,
        marca: 'Copeland',
        modelo: 'CR-400',
        serie: 'CP-2024-00891',
        ubicacion: '893',
        tipo: 'Compresor industrial'
    });
    
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Oscar Leonardo Martinez',
        cedula: '0000001',
        tipoDoc: 'CC',
        telefono: '3114831801',
        cargo: 'Administrador',
        rol: 'admin',
        especialidades: ['mecanico', 'baja', 'media', 'electronico', 'ups', 'planta'],
        region: 'Colombia',
        clave: '1234'
    });
    
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Juan Perez',
        cedula: '10234568',
        tipoDoc: 'CC',
        telefono: '3120000002',
        cargo: 'Tecnico de Campo',
        rol: 'tecnico',
        especialidades: ['baja', 'media'],
        region: 'Cundinamarca',
        clave: '5678'
    });
    
    toast('✅ Listo. Cedula: 0000001 · Clave: 1234');
}

// ===== CSV A FIRESTORE =====
async function guardarTiendasJMC(tiendas, version) {
    const snapshot = await getDocs(collection(db, 'jmc_tiendas'));
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    for (const t of tiendas) {
        await addDoc(collection(db, 'jmc_tiendas'), { ...t, version });
    }
}

async function subirCSVJMC(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        const lines = ev.target.result.split('\n').filter(l => l.trim());
        const nuevas = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length >= 8 && cols[0]) {
                nuevas.push({
                    sap: cols[0],
                    tienda: cols[1],
                    ciudad: cols[2],
                    departamento: cols[3],
                    direccion: cols[4],
                    coordinador: cols[5],
                    cargo: cols[6],
                    telefono: cols[7]
                });
            }
        }
        if (!nuevas.length) { toast('⚠️ CSV inválido'); return; }
        
        const version = `${file.name} · ${new Date().toISOString().split('T')[0]}`;
        await guardarTiendasJMC(nuevas, version);
        jmcTiendas = nuevas;
        jmcTiendasVersion = version;
        input.value = '';
        renderView();
        toast(`✅ ${nuevas.length} tiendas guardadas`);
    };
    reader.readAsText(file, 'UTF-8');
}

function descargarPlantillaCSV() {
    const enc = 'SAP,TIENDA,CIUDAD,DEPARTAMENTO,DIRECCION,COORDINADOR,CARGO,TELEFONO';
    const filas = jmcTiendas.length > 0 
        ? jmcTiendas.slice(0,3).map(t => [t.sap, t.tienda, t.ciudad, t.departamento, t.direccion, t.coordinador, t.cargo, t.telefono].join(','))
        : ['893,Villa del Rosario - Lomitas,Villa del Rosario,Norte de Santander,Anillo Vial No. 12-30,Leny Grimaldos,Coordinador Sr Mantenimiento,3102102100'];
    const csv = [enc, ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'JMC_Tiendas_Plantilla.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('📄 Plantilla descargada');
}

function getTiendaJMC(sap) {
    return jmcTiendas.find(t => t.sap === String(sap));
}

function esClienteJMC(clienteId) {
    const c = getCl(clienteId);
    return c?.nombre === 'Jeronimo Martins Colombia';
}

// ===== HELPERS =====
const getEq = id => equipos.find(e => e.id === id);
const getCl = id => clientes.find(c => c.id === id);
const getTec = id => tecnicos.find(t => t.id === id);
const getEquiposCliente = cid => equipos.filter(e => e.clienteId === cid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosCliente = cid => servicios.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));

function fmtFecha(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES');
}
function fmtFechaLarga(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function getMesActual() { return new Date().toISOString().slice(0, 7); }

function esAdmin() { return sesionActual?.rol === 'admin'; }
function esPropietario(creadoPor) { return sesionActual?.nombre === creadoPor; }
function puedeEditar(creadoPor) { return esAdmin() || esPropietario(creadoPor); }

function toast(msg, duration = 3000) {
    const t = document.getElementById('toastEl');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

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
    fotosNuevas = [null, null, null];
}

function actualizarTopbar() {
    const right = document.getElementById('topbarRight');
    if (!right) return;
    if (!sesionActual) {
        right.innerHTML = `<span class="topbar-user">Sin sesion</span>`;
    } else {
        const initials = sesionActual.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
        const rolBadge = esAdmin() ? `<span class="topbar-rol-badge">Admin</span>` : '';
        right.innerHTML = `
            <div class="topbar-sesion">
                <div class="topbar-avatar">${initials}</div>
                <div>
                    <div style="font-size:0.68rem;color:white;font-weight:700;">${sesionActual.nombre.split(' ')[0]}</div>
                    ${rolBadge}
                </div>
                <button class="topbar-salir" onclick="cerrarSesion()">Salir</button>
            </div>`;
    }
}

function cerrarSesion() {
    sesionActual = null;
    actualizarTopbar();
    renderView();
    toast('👋 Sesion cerrada');
}

// ===== ESTADO =====
let currentView = 'panel';
let sesionActual = null;
let selectedClienteId = null;
let selectedEquipoId = null;
let fotosNuevas = [null, null, null];
let _servicioEidActual = null;

const CIUDADES = ['Bogota', 'Medellin', 'Cali', 'Bucaramanga', 'Barranquilla',
    'Cucuta', 'Manizales', 'Pereira', 'Ibague', 'Villavicencio',
    'Giron', 'Floridablanca', 'Piedecuesta', 'Pamplona', 'Soacha'];

const TIPOS_DOC = ['CC', 'CE', 'PA', 'NIT', 'TI'];

const ESPECIALIDADES = [
    { id: 'mecanico', label: 'Mecanico de plantas' },
    { id: 'baja', label: 'Electricista baja tension' },
    { id: 'media', label: 'Electricista media tension' },
    { id: 'electronico', label: 'Electronico' },
    { id: 'ups', label: 'UPS' },
    { id: 'planta', label: 'Plantas electricas' }
];

// ===== NAVEGACIÓN =====
function goTo(view, cid = null, eid = null) {
    currentView = view;
    selectedClienteId = cid;
    selectedEquipoId = eid;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'detalle' && b.dataset.page === 'clientes') ||
            (view === 'historial' && b.dataset.page === 'clientes'));
    });
}

function renderView() {
    if (!sesionActual && currentView !== 'panel' && currentView !== 'tecnicos') {
        currentView = 'panel';
    }
    
    const main = document.getElementById('mainContent');
    document.getElementById('botnavEl').style.display = 'flex';

    switch (currentView) {
        case 'panel':         main.innerHTML = renderPanel(); break;
        case 'clientes':      main.innerHTML = renderClientes(); break;
        case 'detalle':       main.innerHTML = renderDetalleCliente(); break;
        case 'historial':     main.innerHTML = renderHistorial(); break;
        case 'equipos':       main.innerHTML = renderEquipos(); break;
        case 'servicios':     main.innerHTML = renderServicios(); if(window.aplicarFiltros) aplicarFiltros(); break;
        case 'mantenimientos':main.innerHTML = renderMantenimientos(); break;
        case 'tecnicos':      main.innerHTML = renderTecnicos(); break;
        default:              main.innerHTML = renderPanel();
    }
}

function renderPanel() {
    const mes = getMesActual();
    const man = servicios.filter(s => s.tipo === 'Mantenimiento');
    const rep = servicios.filter(s => s.tipo === 'Reparacion');
    const inst = servicios.filter(s => s.tipo === 'Instalacion');
    const manM = man.filter(s => s.fecha?.startsWith(mes));
    const repM = rep.filter(s => s.fecha?.startsWith(mes));
    const instM = inst.filter(s => s.fecha?.startsWith(mes));
    const nuevosDelMes = clientes.filter(c => c.fechaCreacion?.startsWith(mes)).length;

    return `<div class="page">
        <div class="panel-banner">
            <div class="panel-banner-sub">Plantas y Sistemas Electricos</div>
            <div class="panel-banner-title">Panel Principal</div>
        </div>
        <div class="panel-grid">
            <div class="panel-col">
                <div class="panel-col-head">Clientes</div>
                <div class="panel-box gold-box"><div class="panel-box-num">${clientes.length}</div><div class="panel-box-lbl">TOTALES</div></div>
                <div class="panel-box gold-box"><div class="panel-box-num">${nuevosDelMes}</div><div class="panel-box-lbl">NUEVOS MES</div></div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box anual-box"><div class="panel-box-lbl">ANUAL</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${man.length}</div><div class="panel-box-lbl">MANTENIMIENTO</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${rep.length}</div><div class="panel-box-lbl">REPARACION</div></div>
                <div class="panel-box anual-box"><div class="panel-box-num">${inst.length}</div><div class="panel-box-lbl">INSTALACION</div></div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box mensual-box"><div class="panel-box-lbl">MENSUAL</div></div>
                <div class="panel-box mensual-box"><div class="panel-box-num">${manM.length}</div><div class="panel-box-lbl">MANTENIMIENTO</div></div>
                <div class="panel-box mensual-box"><div class="panel-box-num">${repM.length}</div><div class="panel-box-lbl">REPARACION</div></div>
                <div class="panel-box mensual-box"><div class="panel-box-num">${instM.length}</div><div class="panel-box-lbl">INSTALACION</div></div>
            </div>
        </div>
    </div>`;
}

function renderClientes() {
    return `<div class="page">
        <div class="sec-head"><h2>Clientes (${clientes.length})</h2><button class="btn btn-blue btn-sm" onclick="modalNuevoCliente()">+ Nuevo</button></div>
        <input class="search" placeholder="🔍 Buscar..." oninput="filtrarClientes(this.value)" id="searchClientes">
        <div id="clientesGrid">
            ${clientes.map(c => `
            <div class="cc" data-search="${(c.nombre+c.ciudad+c.telefono+(c.email||'')).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;">
                    <div class="cc-name">${c.nombre}</div>
                    ${esAdmin() ? `<div><button class="ib" onclick="modalEditarCliente('${c.id}')">✏️</button><button class="ib" onclick="modalEliminarCliente('${c.id}')">🗑️</button></div>` : ''}
                </div>
                <div class="cc-row">📞 ${c.telefono}</div>
                ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
                <div class="cc-row">📍 ${c.direccion}</div>
                <span class="city-tag">${c.ciudad}</span>
                ${c.latitud ? `<div><a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver GPS</a></div>` : ''}
                <div class="cc-meta">${getEquiposCliente(c.id).length} activo(s) · ${getServiciosCliente(c.id).length} servicio(s)</div>
                <button class="link-btn" onclick="goTo('detalle','${c.id}')">Ver activos →</button>
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

function renderDetalleCliente() {
    const c = getCl(selectedClienteId);
    if (!c) { goTo('clientes'); return ''; }
    const eqs = getEquiposCliente(c.id);
    return `<div class="page">
        <div class="det-hdr"><button class="back" onclick="goTo('clientes')">← Volver</button><div><div class="cc-name">${c.nombre}</div><div class="cc-meta">${c.ciudad}</div></div></div>
        <div class="info-box">
            <div class="cc-row">📞 <strong>${c.telefono}</strong></div>
            ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
            <div class="cc-row">📍 ${c.direccion}</div>
            ${c.latitud ? `<a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver en Google Maps</a>` : '<div class="cc-meta">Sin GPS</div>'}
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:0.65rem;"><span style="font-weight:700;">Activos (${eqs.length})</span><button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${c.id}')">+ Activo</button></div>
        ${eqs.map(e => `
        <div class="ec">
            <div style="display:flex;justify-content:space-between;">
                <div><div class="ec-name">${e.marca} ${e.modelo}</div><div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie||'S/N'}</div><div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s)</div></div>
                ${esAdmin() ? `<div><button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button><button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button></div>` : ''}
            </div>
            <div class="ec-btns">
                <button class="ab" onclick="goTo('historial','${c.id}','${e.id}')">📋 Servicios</button>
                <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
                <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
            </div>
        </div>`).join('')}
    </div>`;
}

function renderHistorial() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('clientes'); return ''; }
    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(e.id).sort((a,b) => new Date(b.fecha)-new Date(a.fecha));
    return `<div class="page">
        <div class="det-hdr"><button class="back" onclick="goTo('detalle','${e.clienteId}')">← Volver</button><div><div class="ec-name">${e.marca} ${e.modelo}</div><div class="ec-meta">${e.ubicacion} · ${c?.nombre}</div></div></div>
        <div style="margin-bottom:0.65rem;"><span style="font-weight:700;">Historial (${ss.length})</span></div>
        ${ss.map(s => `
        <div class="si">
            <div class="si-top"><span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparacion'?'b-red':'b-green'}">${s.tipo}</span><span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span></div>
            <div class="si-info">🔧 ${s.tecnico}</div>
            <div class="si-info">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div class="si-info" style="color:var(--gold);">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">${(s.fotos||[]).map(f => `<img class="fthumb" src="${f}" loading="lazy">`).join('')}</div>
            <div class="si-top" style="justify-content:flex-end;margin-top:4px;">
                ${puedeEditar(s.tecnico) ? `<button class="ib" onclick="modalEditarServicio('${s.id}')">✏️</button>` : ''}
                ${esAdmin() ? `<button class="ib" onclick="eliminarServicio('${s.id}')">🗑️</button>` : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

function renderEquipos() {
    return `<div class="page">
        <div class="sec-head"><h2>Activos (${equipos.length})</h2></div>
        <input class="search" placeholder="🔍 Buscar..." oninput="filtrarEquipos(this.value)" id="searchEq">
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

function renderServicios() {
    const años = [...new Set(servicios.map(s=>s.fecha?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `<div class="page">
        <div class="sec-head"><h2>Servicios</h2></div>
        <div class="filtros">
            <select class="fi" id="fAnio"><option value="">Todos los años</option>${años.map(a=>`<option>${a}</option>`).join('')}</select>
            <select class="fi" id="fMes"><option value="">Todos los meses</option>${meses.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('')}</select>
            <select class="fi" id="fTipo"><option value="">Todos los tipos</option><option>Mantenimiento</option><option>Reparacion</option><option>Instalacion</option></select>
            <select class="fi" id="fCliente"><option value="">Todos los clientes</option>${clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
            <select class="fi" id="fTecnico"><option value="">Todos los tecnicos</option>${tecnicos.map(t=>`<option>${t.nombre}</option>`).join('')}</select>
            <button class="btn btn-blue btn-full" onclick="aplicarFiltros()">Aplicar</button>
            <button class="btn btn-gray btn-full" onclick="limpiarFiltros()">Limpiar</button>
        </div>
        <div id="listaServicios"></div>
    </div>`;
}

function aplicarFiltros() {
    const anio = document.getElementById('fAnio')?.value||'';
    const mes = document.getElementById('fMes')?.value||'';
    const tipo = document.getElementById('fTipo')?.value||'';
    const cid = document.getElementById('fCliente')?.value||'';
    const tec = document.getElementById('fTecnico')?.value||'';
    let filtrados = [...servicios].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    if (anio) filtrados = filtrados.filter(s=>s.fecha?.startsWith(anio));
    if (mes) filtrados = filtrados.filter(s=>s.fecha?.slice(5,7)===mes);
    if (tipo) filtrados = filtrados.filter(s=>s.tipo===tipo);
    if (cid) filtrados = filtrados.filter(s=>getEquiposCliente(cid).some(e=>e.id===s.equipoId));
    if (tec) filtrados = filtrados.filter(s=>s.tecnico===tec);
    const el = document.getElementById('listaServicios');
    if (!el) return;
    if (!filtrados.length) { el.innerHTML='<p class="cc-meta" style="text-align:center;">Sin resultados.</p>'; return; }
    el.innerHTML = filtrados.map(s => {
        const e = getEq(s.equipoId);
        const c = getCl(e?.clienteId);
        return `<div class="si">
            <div class="si-top"><span class="badge ${s.tipo==='Mantenimiento'?'b-blue':s.tipo==='Reparacion'?'b-red':'b-green'}">${s.tipo}</span><span>${fmtFecha(s.fecha)}</span></div>
            <div class="si-info">👤 ${c?.nombre||'N/A'} · ${e?.marca||''} ${e?.modelo||''}</div>
            <div class="si-info">📍 ${e?.ubicacion||''} · 🔧 ${s.tecnico}</div>
            <div class="si-info">${s.descripcion}</div>
            ${s.proximoMantenimiento?`<div class="si-info" style="color:var(--gold);">📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>`:''}
        </div>`;
    }).join('');
}

function limpiarFiltros() {
    ['fAnio','fMes','fTipo','fCliente','fTecnico'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    aplicarFiltros();
}

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
                    if (!lista.length) return `<tr><td style="color:var(--hint);">${mes}</td><td colspan="4" style="color:#cbd5e1;">—<\/td></tr>`;
                    return lista.map((m,i) => {
                        const e = getEq(m.equipoId);
                        const c = getCl(e?.clienteId);
                        return `<tr>
                            ${i===0?`<td rowspan="${lista.length}" style="font-weight:700;background:var(--bg2);">${mes}<\/td>`:''}
                            <td>${fmtFecha(m.proximoMantenimiento)}<\/td>
                            <td>${c?.nombre||'N/A'}<\/td>
                            <td>${e?`${e.marca} ${e.modelo}`:'N/A'}<\/td>
                            <td><button class="rec-btn" onclick="modalRecordar('${e?.clienteId}','${e?.id}','${m.proximoMantenimiento}')">📱<\/button><\/td>
                        </tr>`;
                    }).join('');
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

function renderTecnicos() {
    return `<div class="page">
        <div class="sec-head"><h2>Tecnicos (${tecnicos.length})</h2>${esAdmin() ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>` : ''}</div>
        ${tecnicos.map(t => {
            const esps = (t.especialidades||[]).map(id => ESPECIALIDADES.find(e=>e.id===id)?.label||id);
            return `<div class="ec">
                <div style="display:flex;justify-content:space-between;">
                    <div><div class="ec-name">${t.nombre}</div><div class="ec-meta">${t.tipoDoc}</div><div class="ec-meta">${t.cargo}</div><div class="ec-meta">📞 ${t.telefono}</div></div>
                    <div><span class="tc-rol-badge ${t.rol==='admin'?'rol-admin':'rol-tec'}">${t.rol==='admin'?'Admin':'Tecnico'}</span>${esAdmin() ? `<div><button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button><button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button></div>` : ''}</div>
                </div>
                <div>${esps.map(e=>`<span class="esp-chip">${e}</span>`).join('')}</div>
                <div class="ec-meta">📍 ${t.region||'Sin region'}</div>
                <button class="btn btn-blue btn-sm btn-full" onclick="abrirLogin('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button>
            </div>`;
        }).join('')}
        ${esAdmin() ? `<div style="margin-top:1.2rem;background:white;border-radius:12px;padding:0.85rem;">
            <div style="font-weight:700;">🏪 Tiendas Jeronimo Martins</div>
            <div class="ec-meta">Version: ${jmcTiendasVersion} · ${jmcTiendas.length} tiendas</div>
            <label class="btn btn-blue btn-sm" style="display:inline-block;margin:4px;">📥 Subir CSV<input type="file" accept=".csv" style="display:none;" onchange="subirCSVJMC(this)"></label>
            <button class="btn btn-gray btn-sm" onclick="descargarPlantillaCSV()">📄 Plantilla</button>
        </div>` : ''}
    </div>`;
}

function abrirLogin(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal" style="max-width:320px;"><div class="modal-h"><h3>🔑 Ingresar</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div style="font-weight:700;">${t.nombre}</div><div class="ec-meta">${t.tipoDoc}</div><label class="fl">Cedula</label><input class="fi" id="mlCedula" type="number"><label class="fl">Clave (4 digitos)</label><div class="pin-display"><div class="pin-digit" id="mlpd0"></div><div class="pin-digit" id="mlpd1"></div><div class="pin-digit" id="mlpd2"></div><div class="pin-digit" id="mlpd3"></div></div><div class="numpad">${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="num-btn" onclick="mlPin('${tid}',${n})">${n}</div>`).join('')}<div class="num-btn del" onclick="mlDel()">⌫</div><div class="num-btn zero" onclick="mlPin('${tid}',0)">0</div><div class="num-btn ok" onclick="mlLogin('${tid}')">✓</div></div><div id="mlMsg"></div><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="mlLogin('${tid}')">Ingresar</button></div></div></div>`);
    window._mlPin = '';
}

let mlPinActual = '';
function mlPin(tid, n) { if (mlPinActual.length >= 4) return; mlPinActual += String(n); mlUpdateDisplay(); if (mlPinActual.length === 4) mlLogin(tid); }
function mlDel() { mlPinActual = mlPinActual.slice(0,-1); mlUpdateDisplay(); }
function mlUpdateDisplay() { for (let i=0;i<4;i++) { const d = document.getElementById('mlpd'+i); if(!d) return; d.className='pin-digit'; if(i<mlPinActual.length){ d.textContent='●'; d.classList.add('filled'); } else if(i===mlPinActual.length){ d.textContent='_'; d.classList.add('active'); } else { d.textContent=''; } } }
function mlLogin(tid) {
    const t = getTec(tid);
    const cedula = document.getElementById('mlCedula')?.value?.trim();
    const msg = document.getElementById('mlMsg');
    if (!cedula) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Cedula requerida</div>'; return; }
    if (mlPinActual.length<4) { if(msg) msg.innerHTML='<div class="login-warn">⚠️ Clave de 4 digitos</div>'; return; }
    if (t.cedula !== cedula || t.clave !== mlPinActual) { if(msg) msg.innerHTML='<div class="login-error">❌ Credenciales incorrectas</div>'; mlPinActual=''; mlUpdateDisplay(); return; }
    sesionActual = t;
    mlPinActual = '';
    closeModal();
    actualizarTopbar();
    currentView='panel';
    renderView();
    toast(`✅ Bienvenido, ${t.nombre.split(' ')[0]}`);
}

// ===== MODAL RECORDAR =====
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
            msg = `Hola *${tienda.coordinador}*, recordatorio: activo *${e?.marca} ${e?.modelo}* tienda *${tienda.tienda} (SAP ${sap})* requiere mantenimiento el *${fechaF}*. Confirmar visita. OLM Ingenieria 📞 3114831801`;
        } else { tel = c?.telefono; destinatario = c?.nombre; msg = `Hola *${c?.nombre}*, recordatorio: activo *${e?.marca} ${e?.modelo}* ubicado en *${e?.ubicacion}* requiere mantenimiento el *${fechaF}*. OLM Ingenieria 📞 3114831801`; }
    } else { tel = c?.telefono; destinatario = c?.nombre; msg = `Hola *${c?.nombre}*, recordatorio: activo *${e?.marca} ${e?.modelo}* requiere mantenimiento el *${fechaF}*. OLM Ingenieria 📞 3114831801`; }
    showModal(`<div class="modal"><div class="modal-h"><h3>📱 Recordatorio WhatsApp</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div class="ec-meta">Para <strong>${destinatario}</strong> · 📞 ${tel}</div><div class="wa-bubble">${msg}</div><textarea class="fi" id="waMsgEdit" rows="4">${msg}</textarea><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-wa" onclick="enviarWhatsApp('${tel}')">📱 Abrir WhatsApp</button></div></div></div>`);
}

function enviarWhatsApp(tel) {
    const msg = document.getElementById('waMsgEdit')?.value||'';
    const telLimpio = '57' + tel.replace(/\D/g,'');
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    closeModal();
    toast('📱 WhatsApp abierto');
}

// ===== NUEVO SERVICIO =====
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if(!desc){ toast('⚠️ Ingresa el diagnostico'); return; }
    
    const tipo = document.getElementById('sTipo').value;
    const fecha = document.getElementById('sFecha').value;
    const prox = tipo === 'Mantenimiento' ? (document.getElementById('proxFecha')?.value || null) : null;
    
    const fotosBase64 = [];
    for (let i = 0; i < fotosNuevas.length; i++) {
        if (fotosNuevas[i]) {
            const base64 = await fileToBase64(fotosNuevas[i]);
            fotosBase64.push(base64);
        }
    }
    
    try {
        await addDoc(collection(db, 'servicios'), {
            equipoId: eid,
            tipo: tipo,
            fecha: fecha,
            tecnico: sesionActual?.nombre || '',
            descripcion: desc,
            proximoMantenimiento: prox,
            fotos: fotosBase64
        });
        closeModal();
        await cargarDatos();
        const e = getEq(eid);
        if(e) goTo('historial', e.clienteId, eid);
        toast('✅ Servicio guardado con ' + fotosBase64.length + ' foto(s)');
    } catch(err) {
        toast('❌ Error: ' + err.message);
    }
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const box = document.getElementById('mantBox');
    if (box) box.classList.toggle('hidden', tipo !== 'Mantenimiento');
}

function previewFoto(input, idx) {
    if (!input.files || !input.files[0]) return;
    fotosNuevas[idx] = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const slot = document.getElementById('fslot' + idx);
        if (slot) slot.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"><button class="fslot-del" onclick="borrarFoto(event,${idx})">✕</button><input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
    };
    reader.readAsDataURL(input.files[0]);
}

function borrarFoto(e, idx) {
    e.stopPropagation();
    fotosNuevas[idx] = null;
    const slot = document.getElementById('fslot' + idx);
    if (slot) {
        slot.innerHTML = `<div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${idx+1}</div><input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick = () => document.getElementById('finput' + idx).click();
    }
}

function modalNuevoServicio(eid) {
    if (!sesionActual) { toast('🔑 Inicia sesion para continuar'); return; }
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const hoy = new Date().toISOString().split('T')[0];
    const esJMC = esClienteJMC(e?.clienteId);
    fotosNuevas = [null, null, null];
    const sapActual = esJMC ? e?.ubicacion : null;
    const tiendaJMC = sapActual ? getTiendaJMC(sapActual) : null;
    
    _servicioEidActual = eid;
    
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="background:var(--bg2);padding:0.55rem;border-radius:8px;margin-bottom:0.65rem;">
                <strong>${c?.nombre}</strong><br>
                <span style="font-size:0.75rem;">${e?.marca} ${e?.modelo} · 📍 ${e?.ubicacion}</span>
                ${tiendaJMC ? `<br><span style="font-size:0.72rem;color:var(--green);">🏪 ${tiendaJMC.tienda} · ${tiendaJMC.ciudad}</span>` : ''}
            </div>
            <div class="fr">
                <div><label class="fl">Tipo *</label><select class="fi" id="sTipo" onchange="onTipoChange()"><option>Mantenimiento</option><option>Reparacion</option><option>Instalacion</option></select></div>
                <div><label class="fl">Fecha *</label><input class="fi" type="date" id="sFecha" value="${hoy}"></div>
            </div>
            <label class="fl">Tecnico</label>
            <input class="fi" id="sTecnico" value="${sesionActual?.nombre||''}" readonly>
            ${esJMC ? `<div style="background:#f5f3ff;border-radius:10px;padding:0.65rem;margin-top:0.65rem;display:flex;justify-content:space-between;align-items:center;"><span style="color:#5b21b6;">📋 Informe tecnico Jeronimo Martins</span><button class="btn btn-sm" style="background:#7c3aed;color:white;" onclick="modalInformeJMC('${eid}')">Abrir</button></div>` : ''}
            <label class="fl">Diagnostico / Descripcion *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado..."></textarea>
            <div class="mant-box hidden" id="mantBox">
                <label class="fl">📅 Proximo mantenimiento</label>
                <input class="fi" type="date" id="proxFecha">
            </div>
            <label class="fl">📷 Fotos (max 3)</label>
            <div class="foto-row">
                ${[0,1,2].map(i => `<div style="flex:1;"><div class="fslot" id="fslot${i}" onclick="document.getElementById('finput${i}').click()"><div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${i+1}</div><input type="file" id="finput${i}" accept="image/*" style="display:none" onchange="previewFoto(this,${i})"></div></div>`).join('')}
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarServicio('${eid}')">💾 Guardar</button>
            </div>
        </div>
    </div>`);
    onTipoChange();
}

function modalEditarServicio(sid) {
    const s = servicios.find(x => x.id === sid);
    if (!s) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div class="fr"><div><label class="fl">Tipo</label><select class="fi" id="esTipo"><option ${s.tipo==='Mantenimiento'?'selected':''}>Mantenimiento</option><option ${s.tipo==='Reparacion'?'selected':''}>Reparacion</option><option ${s.tipo==='Instalacion'?'selected':''}>Instalacion</option></select></div><div><label class="fl">Fecha</label><input class="fi" type="date" id="esFecha" value="${s.fecha}"></div></div><label class="fl">Diagnostico</label><textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea><label class="fl">Proximo mantenimiento</label><input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento||''}"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarServicio('${sid}')">Guardar</button></div></div></div>`);
}

async function actualizarServicio(sid) {
    const tipo = document.getElementById('esTipo')?.value;
    const fecha = document.getElementById('esFecha')?.value;
    const desc = document.getElementById('esDesc')?.value?.trim();
    const prox = document.getElementById('esProx')?.value || null;
    try {
        await updateDoc(doc(db, 'servicios', sid), { tipo, fecha, descripcion: desc, proximoMantenimiento: prox });
        closeModal();
        await cargarDatos();
        toast('✅ Servicio actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarServicio(sid) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try { await deleteDoc(doc(db, 'servicios', sid)); await cargarDatos(); toast('🗑️ Eliminado'); } 
    catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== MODAL INFORME JMC =====
function modalInformeJMC(eid) {
    const e = getEq(eid);
    const hoy = new Date().toISOString().split('T')[0];
    const sapActual = e?.ubicacion;
    const tienda = getTiendaJMC(sapActual);
    const dd = hoy.split('-')[2], mm = hoy.split('-')[1], aa = hoy.split('-')[0].slice(2);

    showModal(`<div class="modal modal-wide"><div class="modal-h" style="background:#1e3a6e;"><h3>📋 Informe Jeronimo Martins — FF-JMC-DT-06</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="background:#0d4a3a;color:white;text-align:center;padding:4px;margin-bottom:6px;border-radius:4px;">CONTRATISTA</div>
            <div class="fr"><div><label class="fl">Razon social</label><input class="fi" value="OLM INGENIERIA SAS" readonly></div><div><label class="fl">NIT</label><input class="fi" value="901.050.468-5" readonly></div></div>
            <div class="fr"><div><label class="fl">Contacto</label><input class="fi" value="Oscar Leonardo Martinez" readonly></div><div><label class="fl">Telefono</label><input class="fi" value="311 4831801" readonly></div></div>
            <div style="background:#0d4a3a;color:white;text-align:center;padding:4px;margin:10px 0 6px;border-radius:4px;">SOLICITANTE Y TIENDA</div>
            <div class="fr"><div><label class="fl">Nombre solicitante</label><input class="fi" id="jNombreSol" value="${tienda?.coordinador||''}" readonly></div><div><label class="fl">Cargo</label><input class="fi" id="jCargo" value="${tienda?.cargo||''}" readonly></div></div>
            <div class="fr"><div><label class="fl">Nombre tienda</label><input class="fi" id="jTienda" value="${tienda?.tienda||''}" readonly></div><div><label class="fl">N° Tienda (SAP)</label><input class="fi" id="jSAP" value="${sapActual||''}" readonly></div></div>
            <div class="fr"><div><label class="fl">N° Ticket</label><input class="fi" id="jTicket" placeholder="TK-..."></div><div><label class="fl">Fecha</label><div style="display:flex;gap:4px;"><input class="fi" id="jDD" placeholder="DD" value="${dd}" style="width:33%;"><input class="fi" id="jMM" placeholder="MM" value="${mm}" style="width:33%;"><input class="fi" id="jAA" placeholder="AA" value="${aa}" style="width:33%;"></div></div></div>
            <div class="fr"><div><label class="fl">Municipio</label><input class="fi" id="jMunicipio" value="${tienda?.ciudad||''}" readonly></div><div><label class="fl">Departamento</label><input class="fi" id="jDepartamento" value="${tienda?.departamento||''}" readonly></div></div>
            <div style="background:#0d4a3a;color:white;text-align:center;padding:4px;margin:10px 0 6px;border-radius:4px;">INFORMACION TECNICA</div>
            <div class="fr"><div><label class="fl">Nombre del equipo</label><input class="fi" id="jEquipo" value="${e?.modelo||''}" readonly></div><div><label class="fl">Marca</label><input class="fi" id="jMarca" value="${e?.marca||''}" readonly></div></div>
            <div><label class="fl">Serial</label><input class="fi" id="jSerial" value="${e?.serie||''}" readonly></div>
            <div style="background:#0d4a3a;color:white;text-align:center;padding:4px;margin:10px 0 6px;border-radius:4px;">TIPO DE ASISTENCIA</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${['Reparacion','Garantia','Ajuste','Modificacion','Servicio','Mejora','Combinacion'].map(t=>`<label><input type="radio" name="jTipoAsi" value="${t}" ${t==='Reparacion'?'checked':''}> ${t}</label>`).join('')}</div>
            <div style="background:#0d4a3a;color:white;text-align:center;padding:4px;margin:10px 0 6px;border-radius:4px;">TIPO DE FALLA</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${['Mecanicas','Material','Instrumentos','Electricas','Influencia Externa'].map(t=>`<label><input type="radio" name="jTipoFalla" value="${t}"> ${t}</label>`).join('')}</div>
            <div style="background:#0d4a3a;color:white;text-align:center;padding:4px;margin:10px 0 6px;border-radius:4px;">CAUSA DE FALLAS</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${['Diseno','Fabricacion/Instalacion','Operacion/Mantenimiento','Administracion','Desconocida'].map(t=>`<label><input type="radio" name="jCausa" value="${t}"> ${t}</label>`).join('')}</div>
            <label class="fl">Descripcion de la falla</label><textarea class="fi" id="jDescFalla" rows="2"></textarea>
            <label class="fl">Diagnostico del tecnico</label><textarea class="fi" id="jDiag" rows="3"></textarea>
            <label class="fl">Repuestos cambiados</label><textarea class="fi" id="jRepuestos" rows="2"></textarea>
            <label class="fl">Observaciones</label><textarea class="fi" id="jObs" rows="2"></textarea>
            <div style="background:#0d4a3a;color:white;text-align:center;padding:4px;margin:10px 0 6px;border-radius:4px;">CONSTANCIA</div>
            <div class="fr"><div><label class="fl">Tecnico encargado</label><input class="fi" value="${sesionActual?.nombre||''}" readonly></div><div><label class="fl">Cedula</label><input class="fi" value="${sesionActual?.cedula||''}" readonly></div></div>
            <div class="fr"><div><label class="fl">Hora entrada</label><input class="fi" type="time" id="jHEntrada"></div><div><label class="fl">Hora salida</label><input class="fi" type="time" id="jHSalida"></div></div>
            <div class="fr"><div><label class="fl">Nombre funcionario</label><input class="fi" id="jFuncNombre"></div><div><label class="fl">Cedula</label><input class="fi" id="jFuncCedula"></div></div>
            <div class="fr"><div><label class="fl">Cargo</label><input class="fi" id="jFuncCargo"></div><div><label class="fl">SAP</label><input class="fi" id="jFuncSAP"></div></div>
            <label class="fl">Firma</label>
            <canvas id="jFirmaCanvas" width="300" height="80" style="width:100%;height:80px;border:1.5px dashed var(--green);border-radius:8px;background:#f0faf5;"></canvas>
            <button class="btn btn-gray btn-sm" onclick="limpiarFirmaJMC()">🗑 Limpiar firma</button>
            <div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="exportarInformeJMC('${eid}')">📄 Exportar PDF</button></div>
        </div>
    </div>`);
    setTimeout(() => iniciarFirmaCanvas('jFirmaCanvas'), 100);
}

function iniciarFirmaCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    let drawing = false, lastX = 0, lastY = 0;
    const getPos = (ev) => { const r = canvas.getBoundingClientRect(); const src = ev.touches ? ev.touches[0] : ev; return [src.clientX - r.left, src.clientY - r.top]; };
    canvas.addEventListener('mousedown', e => { drawing = true; [lastX, lastY] = getPos(e); });
    canvas.addEventListener('mousemove', e => { if (!drawing) return; const [x, y] = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.strokeStyle = '#1a1a6e'; ctx.lineWidth = 2; ctx.stroke(); [lastX, lastY] = [x, y]; });
    canvas.addEventListener('mouseup', () => drawing = false);
    canvas.addEventListener('mouseleave', () => drawing = false);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; [lastX, lastY] = getPos(e); });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!drawing) return; const [x, y] = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke(); [lastX, lastY] = [x, y]; });
    canvas.addEventListener('touchend', () => drawing = false);
}

function limpiarFirmaJMC() {
    const canvas = document.getElementById('jFirmaCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

async function exportarInformeJMC(eid) {
    const e = getEq(eid);
    const canvas = document.getElementById('jFirmaCanvas');
    const firmaDataUrl = canvas ? canvas.toDataURL('image/png') : '';
    const getRadio = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';

    const ticket  = document.getElementById('jTicket')?.value || '';
    const sap     = document.getElementById('jSAP')?.value || '';
    const dd      = document.getElementById('jDD')?.value || '';
    const mm      = document.getElementById('jMM')?.value || '';
    const aa      = document.getElementById('jAA')?.value || '';
    const fechaArch  = dd && mm && aa ? `${dd}-${mm}-${aa}` : new Date().toISOString().split('T')[0];
    const nombreArch = `TK_${ticket || 'sin-ticket'}_SAP_${sap || 'sin-sap'}_${fechaArch}`;

    const tiendaActual      = getTiendaJMC(sap);
    const coordinadorActual = tiendaActual ? tiendaActual.coordinador : document.getElementById('jNombreSol')?.value || '';

    const nomSol    = document.getElementById('jNombreSol')?.value  || '';
    const cargoSol  = document.getElementById('jCargo')?.value      || '';
    const nomTienda = document.getElementById('jTienda')?.value     || '';
    const municipio = document.getElementById('jMunicipio')?.value  || '';
    const depto     = document.getElementById('jDepartamento')?.value || '';
    const nomEquipo = document.getElementById('jEquipo')?.value     || '';
    const marcaEq   = document.getElementById('jMarca')?.value      || '';
    const serialEq  = document.getElementById('jSerial')?.value     || '';
    const descFalla = document.getElementById('jDescFalla')?.value  || '';
    const diag      = document.getElementById('jDiag')?.value       || '';
    const repuestos = document.getElementById('jRepuestos')?.value  || '';
    const obs       = document.getElementById('jObs')?.value        || '';
    const hEntrada  = document.getElementById('jHEntrada')?.value   || '';
    const hSalida   = document.getElementById('jHSalida')?.value    || '';
    const funcNombre= document.getElementById('jFuncNombre')?.value || '';
    const funcCedula= document.getElementById('jFuncCedula')?.value || '';
    const funcCargo = document.getElementById('jFuncCargo')?.value  || '';
    const funcSAP   = document.getElementById('jFuncSAP')?.value    || '';

    const tipoAsi   = getRadio('jTipoAsi');
    const tipoFalla = getRadio('jTipoFalla');
    const causa     = getRadio('jCausa');

    const LOGO_ARA = 'https://raw.githubusercontent.com/capacitADA/OLMapp/main/logo_ara.png';
    const LOGO_JM  = 'https://raw.githubusercontent.com/capacitADA/OLMapp/main/JEronimo_LOGO.png';

    const chk = (val, opt) => val === opt
        ? '<td style="border:1px solid #333;text-align:center;padding:4px;background:#0d4a3a;color:white;font-weight:700;">■</td>'
        : '<td style="border:1px solid #333;text-align:center;padding:4px;">□</td>';

    const evalRow = (label, isSection) => `
        <tr>
            ${isSection ? `<td rowspan="2" style="border:1px solid #333;padding:4px;font-weight:700;font-size:9px;vertical-align:middle;">${label}</td>` : ''}
        </tr>`;

    // Filas de evaluacion del servicio
    const evalRows = [
        { seccion: 'SEGURIDAD',            items: [
            'La labor realizada genera una alta riesgo de accidentalidad para los clientes y/o colaboradores',
            'La labor realizada ofrece algun riesgo para la integridad del equipo'
        ]},
        { seccion: 'FUNCIONAMIENTO',       items: [
            'La falla reportada fue solucionada con el trabajo realizado',
            'Para operar y/o asear el equipo o area intervenida se siguen los pasos normales de manejo anteriores a la asistencia'
        ]},
        { seccion: 'CALIDAD',              items: [
            'La calidad del trabajo esta de acuerdo a la requerida por el personal o el equipo'
        ]},
        { seccion: 'LIMPIEZA Y ORGANIZACION', items: [
            'El equipo o area intervenida se dejo armado y/o organizado como se encontraba en un inicio',
            'Los escombros y suciedad generada por el tecnico fue aseado'
        ]},
        { seccion: 'CAPACITACION',         items: [
            'Se indico la causa de la novedad al personal que recibio el trabajo',
            'Se indico como prevenir que el problema se vuelva a presentar',
            'Se indico como actuar en caso de que el problema se vuelva a presentar'
        ]}
    ];

    let evalHTML = '';
    evalRows.forEach(grupo => {
        grupo.items.forEach((item, idx) => {
            evalHTML += `<tr>
                ${idx === 0 ? `<td rowspan="${grupo.items.length}" style="border:1px solid #333;padding:4px;font-weight:700;font-size:9px;vertical-align:middle;">${grupo.seccion}</td>` : ''}
                <td style="border:1px solid #333;padding:4px;font-size:9px;">${item}</td>
                <td style="border:1px solid #333;text-align:center;padding:4px;font-size:11px;">✗</td>
                <td style="border:1px solid #333;text-align:center;padding:4px;"></td>
            </tr>`;
        });
    });

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${nombreArch}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; padding: 14px; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  td, th { border: 1px solid #333; padding: 3px 5px; vertical-align: top; }
  .hdr-sec { background: #0d4a3a; color: white; font-weight: 700; text-align: center; font-size: 9px; padding: 3px; letter-spacing: 0.5px; }
  .lbl { font-size: 8px; color: #555; display: block; margin-bottom: 1px; }
  .val { font-size: 9px; font-weight: 700; }
  .ticket-box { background: #fff; border: 2px solid #333; text-align: center; }
  .ticket-num { font-size: 22px; font-weight: 900; color: #1a1a6e; letter-spacing: 1px; }
  .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .top-header-center { text-align: center; flex: 1; }
  .top-header-center h2 { margin: 0; font-size: 13px; font-weight: 900; }
  .top-header-center h3 { margin: 0; font-size: 9px; font-weight: 400; }
  .logo-ara { height: 42px; }
  .logo-jm  { height: 38px; }
  .anexo { font-size: 8px; text-align: right; font-weight: 700; }
  @media print { body { padding: 8px; } }
</style>
</head><body>

<div class="anexo">ANEXO 3</div>
<div class="top-header">
  <img src="${LOGO_ARA}" class="logo-ara" onerror="this.style.display='none'">
  <div class="top-header-center">
    <h2>JERONIMO MARTINS COLOMBIA</h2>
    <h3>FORMATO UNICO DE SOPORTE — FF-JMC-DT-06</h3>
  </div>
  <img src="${LOGO_JM}" class="logo-jm" onerror="this.style.display='none'">
</div>

<!-- CONTRATISTA -->
<table>
  <tr><td colspan="6" class="hdr-sec">CONTRATISTA</td></tr>
  <tr>
    <td style="width:18%;"><span class="lbl">Razon social</span><span class="val">OLM INGENIERIA SAS</span></td>
    <td style="width:20%;"><span class="lbl">N° NIT</span><span class="val">901.050.468-5</span></td>
    <td style="width:22%;"><span class="lbl">Contacto</span><span class="val">Oscar Leonardo Martinez</span></td>
    <td style="width:18%;"><span class="lbl">Telefono</span><span class="val">311 4831801</span></td>
    <td colspan="2"></td>
  </tr>
</table>

<!-- SOLICITANTE Y TIENDA -->
<table style="margin-top:-1px;">
  <tr><td colspan="6" class="hdr-sec">SOLICITANTE Y TIENDA BENEFICIARIA</td></tr>
  <tr>
    <td colspan="2"><span class="lbl">Nombre del solicitante</span><span class="val">${nomSol}</span></td>
    <td colspan="2"><span class="lbl">Cargo</span><span class="val">${cargoSol}</span></td>
    <td colspan="2"></td>
  </tr>
  <tr>
    <td colspan="2"><span class="lbl">Nombre de la tienda</span><span class="val">${nomTienda}</span></td>
    <td><span class="lbl">N° Tienda</span><span class="val">${sap}</span></td>
    <td class="ticket-box" colspan="2">
      <span class="lbl" style="color:#555;">N° TICKET:</span>
      <div class="ticket-num">${ticket}</div>
    </td>
    <td><span class="lbl">Fecha</span><span class="val">${dd}/${mm}/${aa}</span></td>
  </tr>
  <tr>
    <td colspan="2"><span class="lbl">Municipio</span><span class="val">${municipio}</span></td>
    <td colspan="2"><span class="lbl">Departamento</span><span class="val">${depto}</span></td>
    <td colspan="2"></td>
  </tr>
</table>

<!-- INFORMACION TECNICA -->
<table style="margin-top:-1px;">
  <tr><td colspan="6" class="hdr-sec">INFORMACION AREA TECNICA</td></tr>
  <tr>
    <td colspan="2"><span class="lbl">Nombre del equipo</span><span class="val">${nomEquipo}</span></td>
    <td colspan="2"><span class="lbl">Marca</span><span class="val">${marcaEq}</span></td>
    <td colspan="2"><span class="lbl">Serial</span><span class="val">${serialEq}</span></td>
  </tr>
</table>

<!-- TIPO DE ASISTENCIA -->
<table style="margin-top:-1px;">
  <tr><td colspan="8" class="hdr-sec">TIPO DE ASISTENCIA</td></tr>
  <tr style="text-align:center;">
    ${['Reparacion','Garantia','Ajuste','Modificacion','Servicio','Mejora','Combinacion'].map(t =>
      `<td style="border:1px solid #333;padding:3px;font-size:9px;">${tipoAsi===t?'■':''} ${t}</td>`
    ).join('')}
  </tr>
</table>

<!-- TIPO DE FALLA -->
<table style="margin-top:-1px;">
  <tr><td colspan="6" class="hdr-sec">TIPO DE FALLA</td></tr>
  <tr style="text-align:center;">
    ${['Mecanicas','Material','Instrumentos','Electricas','Influencia Externa'].map(t =>
      `<td style="border:1px solid #333;padding:3px;font-size:9px;">${tipoFalla===t?'■':''} ${t}</td>`
    ).join('')}
  </tr>
</table>

<!-- CAUSA DE FALLAS -->
<table style="margin-top:-1px;">
  <tr><td colspan="6" class="hdr-sec">CAUSA DE FALLAS BASICAS</td></tr>
  <tr style="text-align:center;">
    ${['Diseno','Fabricacion/Instalacion','Operacion/Mantenimiento','Administracion','Desconocida'].map(t =>
      `<td style="border:1px solid #333;padding:3px;font-size:9px;">${causa===t?'■':''} ${t}</td>`
    ).join('')}
  </tr>
</table>

<!-- DESCRIPCION / DIAGNOSTICO / REPUESTOS / OBS -->
<table style="margin-top:-1px;">
  <tr>
    <td colspan="6"><span class="lbl">Descripcion de la falla funcionario tienda:</span>
      <div style="min-height:28px;font-size:9px;">${descFalla}</div></td>
  </tr>
  <tr>
    <td colspan="6"><span class="lbl">Diagnostico del tecnico:</span>
      <div style="min-height:36px;font-size:9px;">${diag}</div></td>
  </tr>
  <tr>
    <td colspan="6"><span class="lbl">Repuestos cambiados:</span>
      <div style="min-height:22px;font-size:9px;">${repuestos || 'NA'}</div></td>
  </tr>
  <tr>
    <td colspan="6"><span class="lbl">Observaciones:</span>
      <div style="min-height:28px;font-size:9px;">${obs}</div></td>
  </tr>
</table>

<!-- EVALUACION DEL SERVICIO -->
<table style="margin-top:-1px;">
  <tr><td colspan="4" class="hdr-sec">EVALUACION DEL SERVICIO</td></tr>
  <tr>
    <th style="width:18%;font-size:8px;">PARAMETROS DE EVALUACION</th>
    <th style="font-size:8px;"></th>
    <th style="width:10%;text-align:center;font-size:8px;">CUMPLE</th>
    <th style="width:10%;text-align:center;font-size:8px;">NO CUMPLE</th>
  </tr>
  ${evalHTML}
</table>

<!-- CONSTANCIA -->
<table style="margin-top:-1px;">
  <tr><td colspan="6" class="hdr-sec">CONSTANCIA REALIZACION ASISTENCIA</td></tr>
  <tr style="text-align:center;font-size:8px;font-weight:700;">
    <td>Contratistas</td><td>Cedula</td><td>Hora de entrada</td><td>Hora de salida</td><td colspan="2">Datos Funcionario de la tienda</td>
  </tr>
  <tr>
    <td style="font-size:9px;">${sesionActual?.nombre || ''}</td>
    <td style="font-size:9px;">${sesionActual?.cedula || ''}</td>
    <td style="text-align:center;font-size:9px;">${hEntrada}</td>
    <td style="text-align:center;font-size:9px;">${hSalida}</td>
    <td style="font-size:9px;">
      <span class="lbl">Nombre:</span>${funcNombre}<br>
      <span class="lbl">Cedula:</span>${funcCedula}
    </td>
    <td style="font-size:9px;">
      <span class="lbl">Cargo:</span>${funcCargo}<br>
      <span class="lbl">SAP:</span>${funcSAP}
    </td>
  </tr>
</table>

<!-- FIRMA -->
<table style="margin-top:-1px;">
  <tr>
    <td style="width:50%;padding:6px;">
      <span class="lbl">Firma Tecnico Encargado:</span>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px;">${sesionActual?.nombre || ''}</div>
      <span class="lbl">Cargo:</span>
    </td>
    <td style="width:50%;padding:6px;">
      <span class="lbl">Firma:</span>
      ${firmaDataUrl ? `<img src="${firmaDataUrl}" style="height:48px;display:block;margin-top:2px;">` : '<div style="height:48px;"></div>'}
    </td>
  </tr>
</table>

<div style="font-size:7px;color:#888;text-align:right;margin-top:4px;">
  Documento generado por OLM Ingenieria SAS - ${new Date().toLocaleString()}
</div>

</body></html>`;

    // Guardar en Drive como PDF
    const guardado = await driveUploadPDF(html, nombreArch + '.pdf');
    if (guardado) {
        toast('✅ Informe guardado en Drive como PDF');
    } else {
        toast('⚠️ No se pudo guardar en Drive');
    }

    // Abrir para impresión (respaldo)
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank');
    if (ventana) {
        ventana.onload = () => { ventana.print(); };
    }

    closeModal();
    setTimeout(() => {
        if (_servicioEidActual) {
            modalNuevoServicio(_servicioEidActual);
        }
    }, 500);
}

// ===== CRUD CLIENTES =====
function modalNuevoCliente() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><label class="fl">Nombre *</label><input class="fi" id="cNombre"><label class="fl">Telefono *</label><input class="fi" id="cTel" type="tel"><label class="fl">Email</label><input class="fi" id="cEmail"><label class="fl">Ciudad *</label><select class="fi" id="cCiudad">${CIUDADES.map(ci=>`<option>${ci}</option>`).join('')}</select><label class="fl">Direccion *</label><input class="fi" id="cDir"><button class="btn btn-blue btn-full" onclick="obtenerGPS()">📍 Compartir ubicacion</button><input type="hidden" id="cLat"><input type="hidden" id="cLng"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarCliente()">Guardar</button></div></div></div>`);
}

function obtenerGPS() {
    if (!navigator.geolocation) { toast('⚠️ GPS no disponible'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        document.getElementById('cLat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('cLng').value = pos.coords.longitude.toFixed(6);
        toast('✅ Ubicacion capturada');
    }, () => toast('⚠️ No se pudo obtener GPS'));
}

async function guardarCliente() {
    const n = document.getElementById('cNombre')?.value?.trim();
    const t = document.getElementById('cTel')?.value?.trim();
    const ci = document.getElementById('cCiudad')?.value;
    const d = document.getElementById('cDir')?.value?.trim();
    if (!n || !t || !ci || !d) { toast('⚠️ Complete campos obligatorios'); return; }
    try {
        await addDoc(collection(db, 'clientes'), {
            nombre: n, telefono: t, ciudad: ci, direccion: d,
            email: document.getElementById('cEmail')?.value || '',
            latitud: document.getElementById('cLat')?.value || null,
            longitud: document.getElementById('cLng')?.value || null,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });
        closeModal();
        await cargarDatos();
        toast('✅ Cliente guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarCliente(cid) {
    const c = getCl(cid);
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><label class="fl">Nombre</label><input class="fi" id="eNombre" value="${c.nombre}"><label class="fl">Telefono</label><input class="fi" id="eTel" value="${c.telefono}"><label class="fl">Email</label><input class="fi" id="eEmail" value="${c.email || ''}"><label class="fl">Ciudad</label><select class="fi" id="eCiudad">${CIUDADES.map(ci=>`<option ${ci===c.ciudad?'selected':''}>${ci}</option>`).join('')}</select><label class="fl">Direccion</label><input class="fi" id="eDir" value="${c.direccion}"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarCliente('${cid}')">Guardar</button></div></div></div>`);
}

async function actualizarCliente(cid) {
    try {
        await updateDoc(doc(db, 'clientes', cid), {
            nombre: document.getElementById('eNombre').value,
            telefono: document.getElementById('eTel').value,
            email: document.getElementById('eEmail').value,
            ciudad: document.getElementById('eCiudad').value,
            direccion: document.getElementById('eDir').value
        });
        closeModal();
        await cargarDatos();
        toast('✅ Cliente actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarCliente(cid) {
    if (!confirm('¿Eliminar este cliente y todos sus activos/servicios?')) return;
    eliminarCliente(cid);
}

async function eliminarCliente(cid) {
    const eids = getEquiposCliente(cid).map(e => e.id);
    try {
        for (const eid of eids) {
            const ss = getServiciosEquipo(eid);
            for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
            await deleteDoc(doc(db, 'equipos', eid));
        }
        await deleteDoc(doc(db, 'clientes', cid));
        await cargarDatos();
        goTo('clientes');
        toast('🗑️ Cliente eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD EQUIPOS =====
function modalNuevoEquipo(cid) {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div class="fr"><div><label class="fl">Marca *</label><input class="fi" id="qMarca"></div><div><label class="fl">Modelo *</label><input class="fi" id="qModelo"></div></div><label class="fl">Serie</label><input class="fi" id="qSerie"><label class="fl">Ubicacion *</label><input class="fi" id="qUbic"><label class="fl">Tipo</label><input class="fi" id="qTipo"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarEquipo('${cid}')">Guardar</button></div></div></div>`);
}

async function guardarEquipo(cid) {
    const m = document.getElementById('qMarca')?.value?.trim();
    const mo = document.getElementById('qModelo')?.value?.trim();
    const u = document.getElementById('qUbic')?.value?.trim();
    if (!m || !mo || !u) { toast('⚠️ Complete marca, modelo y ubicacion'); return; }
    try {
        await addDoc(collection(db, 'equipos'), {
            clienteId: cid, marca: m, modelo: mo,
            serie: document.getElementById('qSerie')?.value || '',
            ubicacion: u, tipo: document.getElementById('qTipo')?.value || ''
        });
        closeModal();
        await cargarDatos();
        toast('✅ Activo guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarEquipo(eid) {
    const eq = getEq(eid);
    if (!eq) return;
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><div class="fr"><div><label class="fl">Marca</label><input class="fi" id="eMarca" value="${eq.marca}"></div><div><label class="fl">Modelo</label><input class="fi" id="eModelo" value="${eq.modelo}"></div></div><label class="fl">Serie</label><input class="fi" id="eSerie" value="${eq.serie || ''}"><label class="fl">Ubicacion</label><input class="fi" id="eUbic" value="${eq.ubicacion}"><label class="fl">Tipo</label><input class="fi" id="eTipoEq" value="${eq.tipo || ''}"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar</button></div></div></div>`);
}

async function actualizarEquipo(eid) {
    try {
        await updateDoc(doc(db, 'equipos', eid), {
            marca: document.getElementById('eMarca').value,
            modelo: document.getElementById('eModelo').value,
            serie: document.getElementById('eSerie').value,
            ubicacion: document.getElementById('eUbic').value,
            tipo: document.getElementById('eTipoEq').value
        });
        closeModal();
        await cargarDatos();
        toast('✅ Activo actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarEquipo(eid) {
    if (!confirm('¿Eliminar este activo y sus servicios?')) return;
    eliminarEquipo(eid);
}

async function eliminarEquipo(eid) {
    const ss = getServiciosEquipo(eid);
    try {
        for (const s of ss) await deleteDoc(doc(db, 'servicios', s.id));
        await deleteDoc(doc(db, 'equipos', eid));
        await cargarDatos();
        toast('🗑️ Activo eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD TECNICOS =====
function modalNuevoTecnico() {
    showModal(`<div class="modal"><div class="modal-h"><h3>Nuevo tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><label class="fl">Nombre *</label><input class="fi" id="tNombre"><div class="fr"><div><label class="fl">Tipo Doc</label><select class="fi" id="tTipoDoc">${TIPOS_DOC.map(d=>`<option>${d}</option>`).join('')}</select></div><div><label class="fl">Cedula *</label><input class="fi" id="tCedula" type="number"></div></div><label class="fl">Telefono</label><input class="fi" id="tTel"><label class="fl">Cargo</label><input class="fi" id="tCargo"><label class="fl">Rol</label><select class="fi" id="tRol"><option value="tecnico">Tecnico</option><option value="admin">Admin</option></select><label class="fl">Clave (4 digitos) *</label><input class="fi" id="tClave" type="password" maxlength="4"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button></div></div></div>`);
}

async function guardarTecnico() {
    const n = document.getElementById('tNombre')?.value?.trim();
    const cc = document.getElementById('tCedula')?.value?.trim();
    const cl = document.getElementById('tClave')?.value?.trim();
    if (!n || !cc || !cl) { toast('⚠️ Nombre, cedula y clave requeridos'); return; }
    if (cl.length !== 4) { toast('⚠️ Clave de 4 digitos'); return; }
    try {
        await addDoc(collection(db, 'tecnicos'), {
            nombre: n, cedula: cc,
            tipoDoc: document.getElementById('tTipoDoc')?.value || 'CC',
            telefono: document.getElementById('tTel')?.value || '',
            cargo: document.getElementById('tCargo')?.value || '',
            rol: document.getElementById('tRol')?.value || 'tecnico',
            especialidades: [],
            region: '',
            clave: cl
        });
        closeModal();
        await cargarDatos();
        toast('✅ Tecnico guardado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

function modalEditarTecnico(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal"><div class="modal-h"><h3>Editar tecnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><label class="fl">Nombre</label><input class="fi" id="etNombre" value="${t.nombre}"><label class="fl">Cedula</label><input class="fi" id="etCedula" value="${t.cedula}"><label class="fl">Telefono</label><input class="fi" id="etTel" value="${t.telefono}"><label class="fl">Cargo</label><input class="fi" id="etCargo" value="${t.cargo || ''}"><label class="fl">Rol</label><select class="fi" id="etRol"><option value="tecnico" ${t.rol==='tecnico'?'selected':''}>Tecnico</option><option value="admin" ${t.rol==='admin'?'selected':''}>Admin</option></select><label class="fl">Nueva clave (opcional)</label><input class="fi" id="etClave" type="password" maxlength="4"><div class="modal-foot"><button class="btn btn-gray" onclick="closeModal()">Cancelar</button><button class="btn btn-blue" onclick="actualizarTecnico('${tid}')">Guardar</button></div></div></div>`);
}

async function actualizarTecnico(tid) {
    const data = {
        nombre: document.getElementById('etNombre').value,
        cedula: document.getElementById('etCedula').value,
        telefono: document.getElementById('etTel').value,
        cargo: document.getElementById('etCargo').value,
        rol: document.getElementById('etRol').value
    };
    const newClave = document.getElementById('etClave')?.value?.trim();
    if (newClave && newClave.length === 4) data.clave = newClave;
    try {
        await updateDoc(doc(db, 'tecnicos', tid), data);
        closeModal();
        await cargarDatos();
        toast('✅ Tecnico actualizado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

async function eliminarTecnico(tid) {
    if (!confirm('¿Eliminar este tecnico?')) return;
    try {
        await deleteDoc(doc(db, 'tecnicos', tid));
        await cargarDatos();
        toast('🗑️ Tecnico eliminado');
    } catch(err) { toast('❌ Error: ' + err.message); }
}

// ===== OTRAS FUNCIONES =====
function generarInformePDF(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe_${e?.marca}_${e?.modelo}</title><style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;}td,th{border:1px solid #ccc;padding:8px;}</style></head><body><h1>OLM INGENIERIA SAS</h1><h2>Informe Tecnico</h2><p><strong>Cliente:</strong> ${c?.nombre || 'N/A'}</p><p><strong>Activo:</strong> ${e?.marca} ${e?.modelo} - Serie: ${e?.serie || 'N/A'}</p><p><strong>Ubicacion:</strong> ${e?.ubicacion || 'N/A'}</p><h3>Historial de Servicios</h3></table><tr><th>Fecha</th><th>Tipo</th><th>Tecnico</th><th>Descripcion</th></tr>${ss.map(s => `<tr><td>${fmtFecha(s.fecha)}</td><td>${s.tipo}</td><td>${s.tecnico}</td><td>${s.descripcion}</td></tr>`).join('')}</table><p>Total de servicios: ${ss.length}</p><p>Generado: ${new Date().toLocaleString()}</p></body></html>`;
    const v = window.open('', '_blank');
    v.document.write(html);
    v.document.close();
    v.print();
}

function modalQR(eid) {
    const e = getEq(eid);
    const url = `${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:260px;height:260px;';
    document.body.appendChild(qrDiv);
    const QRLib = window.QRCode;
    if (!QRLib) { toast('⚠️ QRCode.js no cargado'); return; }
    new QRLib(qrDiv, { text: url, width: 260, height: 260, colorDark: '#0d4a3a', colorLight: '#ffffff' });
    setTimeout(() => {
        const qrCanvas = qrDiv.querySelector('canvas');
        const dataUrl = qrCanvas.toDataURL('image/png');
        showModal(`<div class="modal" style="max-width:340px;"><div class="modal-h"><h3>📱 QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div><div class="modal-b"><img src="${dataUrl}" style="width:100%;"><a href="${dataUrl}" download="QR_${e?.marca}_${e?.modelo}.png" class="btn btn-blue btn-full">⬇️ Descargar</a></div></div>`);
        document.body.removeChild(qrDiv);
    }, 200);
}

function manejarRutaQR() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/equipo/')) return false;
    const eid = hash.replace('#/equipo/', '');
    const e = getEq(eid);
    if (!e) return false;
    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const main = document.getElementById('mainContent');
    const topbar = document.querySelector('.topbar');
    const botnav = document.querySelector('.botnav');
    if (topbar) topbar.style.display = 'none';
    if (botnav) botnav.style.display = 'none';
    main.style.background = 'white';
    main.innerHTML = `<div style="max-width:600px;margin:0 auto;padding:1.5rem;"><div style="text-align:center;"><h2 style="color:#0d4a3a;">OLM INGENIERIA SAS</h2><p>📞 311 483 1801</p></div><div style="background:#0d4a3a;border-radius:14px;padding:14px;color:white;text-align:center;"><div>¿Necesitas soporte?</div><div style="font-size:2rem;font-weight:700;">311 483 1801</div></div><div style="border:1px solid #ccc;border-radius:12px;padding:1rem;margin:1rem 0;"><h3>${e.marca} ${e.modelo}</h3><p>📍 ${e.ubicacion}</p><p>👤 ${c?.nombre}</p><p>Serie: ${e.serie || 'N/A'}</p></div><button style="width:100%;background:#25D366;color:white;border:none;padding:14px;border-radius:12px;" onclick="window.open('https://wa.me/573114831801?text=${encodeURIComponent('Hola OLM, necesito soporte para ' + (e?.marca||'') + ' ' + (e?.modelo||''))}','_blank')">📱 Contactar por WhatsApp</button><h3>Historial (${ss.length})</h3>${ss.map(s => `<div style="border:1px solid #d1ede0;border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;"><div><strong>${s.tipo}</strong> - ${fmtFecha(s.fecha)}</div><div>🔧 ${s.tecnico}</div><div>${s.descripcion}</div>${s.proximoMantenimiento ? `<div>📅 Proximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}</div>`).join('')}</div>`;
    return true;
}

// ===== GLOBALS Y EVENTOS =====
window.goTo = goTo;
window.closeModal = closeModal;
window.filtrarClientes = filtrarClientes;
window.filtrarEquipos = filtrarEquipos;
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.modalNuevoCliente = modalNuevoCliente;
window.modalEditarCliente = modalEditarCliente;
window.modalEliminarCliente = modalEliminarCliente;
window.guardarCliente = guardarCliente;
window.actualizarCliente = actualizarCliente;
window.modalNuevoEquipo = modalNuevoEquipo;
window.modalEditarEquipo = modalEditarEquipo;
window.modalEliminarEquipo = modalEliminarEquipo;
window.guardarEquipo = guardarEquipo;
window.actualizarEquipo = actualizarEquipo;
window.modalNuevoServicio = modalNuevoServicio;
window.modalEditarServicio = modalEditarServicio;
window.guardarServicio = guardarServicio;
window.actualizarServicio = actualizarServicio;
window.eliminarServicio = eliminarServicio;
window.modalNuevoTecnico = modalNuevoTecnico;
window.modalEditarTecnico = modalEditarTecnico;
window.guardarTecnico = guardarTecnico;
window.actualizarTecnico = actualizarTecnico;
window.eliminarTecnico = eliminarTecnico;
window.modalRecordar = modalRecordar;
window.enviarWhatsApp = enviarWhatsApp;
window.modalInformeJMC = modalInformeJMC;
window.limpiarFirmaJMC = limpiarFirmaJMC;
window.exportarInformeJMC = exportarInformeJMC;
window.subirCSVJMC = subirCSVJMC;
window.descargarPlantillaCSV = descargarPlantillaCSV;
window.generarInformePDF = generarInformePDF;
window.modalQR = modalQR;
window.obtenerGPS = obtenerGPS;
window.previewFoto = previewFoto;
window.borrarFoto = borrarFoto;
window.onTipoChange = onTipoChange;
window.abrirLogin = abrirLogin;
window.mlPin = mlPin;
window.mlDel = mlDel;
window.mlLogin = mlLogin;
window.cerrarSesion = cerrarSesion;

document.querySelectorAll('.bni').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (!sesionActual && page !== 'panel' && page !== 'tecnicos') {
            toast('🔒 Inicia sesion desde Tecnicos');
            return;
        }
        selectedClienteId = null;
        selectedEquipoId = null;
        goTo(page);
    });
});

// ===== INICIAR APP =====
(async () => {
    await conectarDriveAuto();
    await sembrarDatos();
    await cargarDatos();
    if (!manejarRutaQR()) renderView();
})();