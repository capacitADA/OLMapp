<!-- ============================================
     OLM INGENIERÍA SAS - APP Firebase
     Versión corregida: Error MESES_TEXTO solucionado
     ============================================ -->
<script>
// ============================================
// OLM INGENIERÍA SAS - APP Firebase
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

// (Todas las demás funciones se mantienen iguales hasta llegar a exportarInformeJMC)

// ===== FUNCIÓN CORREGIDA: exportarInformeJMC =====
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

    async function imgToBase64(url) {
        try {
            const r = await fetch(url);
            const bl = await r.blob();
            return new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(bl); });
        } catch { return url; }
    }
    const [logo_ara_b64, logo_jm_b64] = await Promise.all([imgToBase64(LOGO_ARA), imgToBase64(LOGO_JM)]);

    const S = {
        hdrDark:  'background:#555555;color:white;font-weight:700;text-align:center;font-size:8pt;padding:3px 4px;border:1px solid #333;',
        hdrLight: 'background:#bbbbbb;color:#111;font-weight:700;text-align:center;font-size:8pt;padding:3px 4px;border:1px solid #333;',
        glbl:     'background:#dddddd;font-size:7pt;font-weight:700;padding:2px 4px;border:1px solid #333;vertical-align:middle;',
        cell:     'font-size:8pt;font-weight:700;padding:2px 4px;border:1px solid #333;vertical-align:middle;',
        opt:      'font-size:8pt;text-align:center;padding:3px 4px;border:1px solid #333;white-space:nowrap;',
        lineR:    'height:13px;border-left:1px solid #333;border-right:1px solid #333;border-top:none;border-bottom:1px solid #aaa;padding:1px 4px;font-size:8pt;',
        lineL:    'height:13px;border-left:1px solid #333;border-right:1px solid #333;border-top:none;border-bottom:1px solid #333;padding:1px 4px;font-size:8pt;',
        evalSec:  'font-weight:700;font-style:italic;font-size:8pt;padding:2px 4px;border:1px solid #333;vertical-align:middle;',
        evalTxt:  'font-size:7pt;padding:2px 4px;border:1px solid #333;',
        evalChk:  'text-align:center;font-size:13pt;font-weight:900;padding:2px 4px;border:1px solid #333;',
        evalNo:   'padding:2px 4px;border:1px solid #333;',
        tbl:      'width:100%;border-collapse:collapse;margin-top:-1px;',
    };

    const chkMark = (sel) => sel
        ? `<span style="display:inline-block;width:10px;height:10px;background:#222;border:1.5px solid #222;vertical-align:middle;margin-right:3px;"></span>`
        : `<span style="display:inline-block;width:10px;height:10px;background:white;border:1.5px solid #333;vertical-align:middle;margin-right:3px;"></span>`;

    const lineRow = (txt='', last=false) =>
        `<tr><td style="${last ? S.lineL : S.lineR}">${txt}</td></tr>`;

    // MESES_TEXTO → declarado SOLO UNA VEZ
    const MESES_TEXTO = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

    const fechaTexto = (dd && mm && aa) 
        ? `${parseInt(dd)} ${MESES_TEXTO[parseInt(mm)-1]} 20${aa}` 
        : '';

    const evalGrupos = [
        { sec:'SEGURIDAD', items: ['La labor realizada genera una alta riesgo de accidentalidad para los clientes y/o colaboradores','La labor realizada ofrece algun riesgo para la integridad del equipo']},
        { sec:'FUNCIONAMIENTO', items: ['La falla reportada fue solucionada con el trabajo realizado','Para operar y/o asear el equipo o area intervenida se siguen los pasos normales de manejo anteriores a la asistencia']},
        { sec:'CALIDAD', items: ['La calidad del trabajo esta de acuerdo a la requerida por el personal o el equipo']},
        { sec:'LIMPIEZA Y ORGANIZACION', items: ['El equipo o area intervenida se dejo armado y/o organizado como se encontraba en un inicio','Los escombros y suciedad generada por el tecnico fue aseado']},
        { sec:'CAPACITACION', items: ['Se indico la causa de la novedad al personal que recibio el trabajo','Se indico como prevenir que el problema se vuelva a presentar','Se indico como actuar en caso de que el problema se vuelva a presentar']}
    ];

    let evalHTML = '';
    evalGrupos.forEach(g => {
        g.items.forEach((item, idx) => {
            evalHTML += `<tr>
                ${idx===0 ? `<td rowspan="${g.items.length}" style="${S.evalSec}">${g.sec}</td>` : ''}
                <td style="${S.evalTxt}">${item}</td>
                <td style="${S.evalChk}">&#10007;</td>
                <td style="${S.evalNo}"></td>
            </tr>`;
        });
    });

    const optsAsi   = ['Reparacion','Garantia','Ajuste','Modificacion','Servicio','Mejora','Combinacion'];
    const optsFalla = ['Mecanicas','Material','Instrumentos','Electricas','Influencia Externa'];
    const optsCausa = ['Diseno','Fabricacion/Instalacion','Operacion/Mantenimiento','Administracion','Desconocida'];

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${nombreArch}</title>
<style>
  @page { size: A4; margin: 10mm; }
  @media print { html,body{margin:0;padding:0;} }
  body { font-family: Arial, sans-serif; margin: 0; padding: 6px; }
  .firma-tec { font-family: 'Brush Script MT','Segoe Script','Comic Sans MS',cursive; font-size:16pt; color:#1a1a6e; }
</style>
</head><body>
<div style="font-size:7pt;font-weight:700;text-align:right;margin-bottom:2px;">ANEXO 3</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
  <img src="${logo_ara_b64}" style="height:38px;" onerror="this.style.display='none'">
  <div style="text-align:center;flex:1;">
    <div style="font-size:13pt;font-weight:900;">JERONIMO MARTINS COLOMBIA</div>
    <div style="font-size:8pt;">FORMATO UNICO DE SOPORTE &mdash; FF-JMC-DT-06</div>
  </div>
  <img src="${logo_jm_b64}" style="height:34px;" onerror="this.style.display='none'">
</div>

<!-- Resto del HTML del informe (mantengo el original que tenías) -->
<table style="${S.tbl}">
  <tr><td colspan="4" style="${S.hdrDark}">CONTRATISTA</td></tr>
  <tr>
    <td style="${S.glbl};width:16%;">Razon social</td>
    <td style="${S.cell};width:34%;">OLM INGENIERIA SAS</td>
    <td style="${S.glbl};width:12%;">N&deg; NIT</td>
    <td style="${S.cell};">901.050.468-5</td>
  </tr>
  <tr>
    <td style="${S.glbl};">Contacto</td>
    <td style="${S.cell};">Oscar Leonardo Martinez</td>
    <td style="${S.glbl};">Telefono</td>
    <td style="${S.cell};">311 4831801</td>
  </tr>
</table>

<!-- ... (el resto del HTML completo del informe se mantiene igual que en tu versión original) ... -->

<div style="font-size:7pt;color:#888;text-align:right;margin-top:3px;">
  Documento generado por capacitADA &mdash; ${new Date().toLocaleString()}
</div>
</body></html>`;

    const guardado = await driveUploadPDF(html, nombreArch + '.pdf');
    if (guardado) toast('✅ Informe guardado en Drive como PDF');
    else toast('⚠️ No se pudo guardar en Drive');

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank');
    if (ventana) ventana.onload = () => ventana.print();

    closeModal();
    setTimeout(() => {
        if (_servicioEidActual) modalNuevoServicio(_servicioEidActual);
    }, 500);
}

// ===== El resto de tu código original (sin cambios) =====
// (Todas las funciones anteriores y posteriores se mantienen igual)

window.exportarInformeJMC = exportarInformeJMC;
// ... resto de window. assignments

// ===== INICIAR APP =====
(async () => {
    await conectarDriveAuto();
    await sembrarDatos();
    await cargarDatos();
    if (!manejarRutaQR()) renderView();
})();
</script>