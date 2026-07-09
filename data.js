// ══════════════════════════════════════════════
//  SISTEMA DE USUARIOS Y ROLES
// ══════════════════════════════════════════════
const USERS_KEY = 'simpoe_v3_users';
const STORAGE_KEY = 'simpoe_v3_data';

// ══ EMPRESAS POR DEFECTO ══
const DEFAULT_EMPRESAS = [
  { id:1, nombre:'Transportes del Caribe S.A.S',  nit:'900.111.222-1', tipo:'transporte',   responsable:'Jorge Ramírez', ciudad:'Barranquilla', pais:'Colombia', telefono:'+57 305 100 0001', email:'contacto@transcaribe.co',  color:'#0ea5e9', logoText:'TC', creadaEn:'2025-01-01', activa:true },
  { id:2, nombre:'Industrias Mecánicas Orozco',   nit:'900.222.333-2', tipo:'industrial',   responsable:'Marta Solano',  ciudad:'Barranquilla', pais:'Colombia', telefono:'+57 305 100 0002', email:'contacto@orozco.co',       color:'#3aaa5c', logoText:'IM', creadaEn:'2025-01-02', activa:true },
  { id:3, nombre:'Constructora Caribe S.A.S',     nit:'800.654.321-0', tipo:'construccion', responsable:'Andrés Pérez',  ciudad:'Cartagena',     pais:'Colombia', telefono:'+57 305 100 0003', email:'info@caribesas.co',        color:'#d4960c', logoText:'CC', creadaEn:'2025-01-03', activa:true },
  { id:4, nombre:'Corporación Activos Atlántico', nit:'900.444.555-4', tipo:'activos',      responsable:'Diana Cortés',  ciudad:'Barranquilla', pais:'Colombia', telefono:'+57 305 100 0004', email:'gestion@activosatl.co',    color:'#0ea5e9', logoText:'CA', creadaEn:'2025-01-04', activa:true },
];

// ══ USUARIOS POR DEFECTO ══
const DEFAULT_USERS = [
  { id:1,  email:'admin@simmp.co',         pass:'admin123', nombre:'Super Administrador', role:'superadmin', initials:'SA', empresaId:null, creadoPor:'Sistema',       creadoEn:'2025-01-01' },
  { id:2,  email:'admin@transcaribe.co',   pass:'admin123', nombre:'Jorge Ramírez',   role:'admin',    initials:'JR', empresaId:1, creadoPor:'Super Admin',     creadoEn:'2025-01-01' },
  { id:3,  email:'tecnico@transcaribe.co', pass:'tec456',   nombre:'Pedro Martínez',  role:'tecnico',  initials:'PM', empresaId:1, creadoPor:'Jorge Ramírez',   creadoEn:'2025-01-02' },
  { id:4,  email:'operador@transcaribe.co',pass:'op789',    nombre:'Luisa Cantillo',  role:'operador', initials:'LC', empresaId:1, creadoPor:'Jorge Ramírez',   creadoEn:'2025-01-03' },
  { id:5,  email:'admin@orozco.co',        pass:'admin123', nombre:'Marta Solano',    role:'admin',    initials:'MS', empresaId:2, creadoPor:'Super Admin',     creadoEn:'2025-01-02' },
  { id:6,  email:'tecnico@orozco.co',      pass:'tec456',   nombre:'Andrés López',    role:'tecnico',  initials:'AL', empresaId:2, creadoPor:'Marta Solano',    creadoEn:'2025-01-03' },
  { id:7,  email:'operador@orozco.co',     pass:'op789',    nombre:'Diego Vargas',    role:'operador', initials:'DV', empresaId:2, creadoPor:'Marta Solano',    creadoEn:'2025-01-04' },
  { id:8,  email:'admin@caribesas.co',     pass:'admin123', nombre:'Andrés Pérez',    role:'admin',    initials:'AP', empresaId:3, creadoPor:'Super Admin',     creadoEn:'2025-01-03' },
  { id:9,  email:'tecnico@caribesas.co',   pass:'tec456',   nombre:'Luis Moreno',     role:'tecnico',  initials:'LM', empresaId:3, creadoPor:'Andrés Pérez',    creadoEn:'2025-01-04' },
  { id:10, email:'operador@caribesas.co',  pass:'op789',    nombre:'Carlos Builes',   role:'operador', initials:'CB', empresaId:3, creadoPor:'Andrés Pérez',    creadoEn:'2025-01-05' },
  { id:11, email:'admin@activosatl.co',    pass:'admin123', nombre:'Diana Cortés',    role:'admin',    initials:'DC', empresaId:4, creadoPor:'Super Admin',     creadoEn:'2025-01-04' },
  { id:12, email:'tecnico@activosatl.co',  pass:'tec456',   nombre:'Ricardo Núñez',   role:'tecnico',  initials:'RN', empresaId:4, creadoPor:'Diana Cortés',    creadoEn:'2025-01-05' },
];

function cargarEmpresasYUsuarios() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.usuarios && Array.isArray(parsed.usuarios) && parsed.usuarios.length > 0
          && parsed.usuarios[0].email && parsed.usuarios[0].pass) {
        return { empresas: parsed.empresas || JSON.parse(JSON.stringify(DEFAULT_EMPRESAS)),
                 usuarios: parsed.usuarios };
      }
    }
  } catch(e) { console.warn('SIMPOE: datos corrompidos, usando defaults'); }
  try { localStorage.removeItem(USERS_KEY); } catch(e) {}
  return {
    empresas: JSON.parse(JSON.stringify(DEFAULT_EMPRESAS)),
    usuarios: JSON.parse(JSON.stringify(DEFAULT_USERS))
  };
}

function cargarUsuarios() { return cargarEmpresasYUsuarios().usuarios; }

function guardarUsuarios() {
  try { localStorage.setItem(USERS_KEY, JSON.stringify({ empresas, usuarios })); } catch(e) {}
}

// ── Inicializamos los datos desde localStorage ──
// (se sobreescribe si hay sesión de Supabase activa)
let _loaded = cargarEmpresasYUsuarios();
let empresas    = _loaded.empresas;
let usuarios    = _loaded.usuarios;
let nextUserId    = Math.max(...usuarios.map(u=>u.id), 0) + 1;
let nextEmpresaId = Math.max(...empresas.map(e=>e.id), 0) + 1;
let currentUser = null;
let empresaActual = null;

let equipos = [
  { id:1, nombre:'Aire Acond. 1',   tipo:'Aire Acondicionado', horasRec:600,  horasDia:8,  factor:1.0, horasAcum:200, ubicacion:'Oficina Principal',     notas:'Marca: LG, Modelo BTU18' },
  { id:2, nombre:'Motor Principal', tipo:'Motor',              horasRec:500,  horasDia:10, factor:1.2, horasAcum:450, ubicacion:'Planta de Producción',  notas:'Motor trifásico 15HP' },
  { id:3, nombre:'Bomba Hidráulica',tipo:'Bomba',              horasRec:400,  horasDia:12, factor:1.5, horasAcum:395, ubicacion:'Área de Bombeo',        notas:'Bomba centrífuga 5HP' },
  { id:4, nombre:'Planta Eléctrica',tipo:'Generador',          horasRec:800,  horasDia:6,  factor:0.8, horasAcum:120, ubicacion:'Subestación',           notas:'Generador emergencia 50KVA' },
  { id:5, nombre:'Bus #12',         tipo:'Bus / Vehículo',     horasRec:1000, horasDia:14, factor:1.3, horasAcum:750, ubicacion:'Flota Urbana',          notas:'Placa: XYZ-123, Diesel' },
];

let mantenimientos = [
  { id:1, equipoId:1, equipoNombre:'Aire Acond. 1',    fecha:'2025-01-15', tipo:'Preventivo', desc:'Limpieza de filtros y revisión del gas refrigerante',               tecnico:'Carlos Pérez',    costo:150000 },
  { id:2, equipoId:2, equipoNombre:'Motor Principal',  fecha:'2025-02-20', tipo:'Correctivo', desc:'Reemplazo de rodamientos desgastados por falla en operación',       tecnico:'Andrés López',   costo:320000 },
  { id:3, equipoId:3, equipoNombre:'Bomba Hidráulica', fecha:'2025-03-10', tipo:'Preventivo', desc:'Cambio de sellos y revisión de presión hidráulica programada',      tecnico:'Juan García',    costo:95000  },
  { id:4, equipoId:5, equipoNombre:'Bus #12',          fecha:'2025-03-22', tipo:'Correctivo', desc:'Reparación de frenos traseros por desgaste excesivo imprevisto',    tecnico:'Luis Martínez',  costo:480000 },
  { id:5, equipoId:4, equipoNombre:'Planta Eléctrica', fecha:'2025-04-01', tipo:'Preventivo', desc:'Revisión de bornes, cables y prueba de carga al 75%',               tecnico:'Carlos Pérez',    costo:120000 },
  { id:6, equipoId:2, equipoNombre:'Motor Principal',  fecha:'2025-04-10', tipo:'Preventivo', desc:'Lubricación general y revisión de correas de transmisión',          tecnico:'Andrés López',   costo:85000  },
  { id:7, equipoId:1, equipoNombre:'Aire Acond. 1',    fecha:'2025-05-05', tipo:'Correctivo', desc:'Cambio de compresor por falla térmica inesperada a los 220h',       tecnico:'Técnico Externo', costo:550000 },
  { id:8, equipoId:3, equipoNombre:'Bomba Hidráulica', fecha:'2025-06-12', tipo:'Predictivo', desc:'Análisis de vibración detectó desgaste — ajuste preventivo ejecutado',tecnico:'Juan García',   costo:70000  },
];

let nextEqId = 6, nextMantId = 9, eqTabFilter = 'all';
let chTipos=null, chIAHist=null;

const FACTOR_CORR = 3.2;
function getEmpresaKey() {
  const eid = empresaActual ? empresaActual.id : 'global';
  return STORAGE_KEY + '_emp_' + eid;
}

function guardarDatos() {
  try {
    const key = getEmpresaKey();
    localStorage.setItem(key, JSON.stringify({ equipos, mantenimientos, fallas, nextEqId, nextMantId, nextFallaId }));
    const ind = document.getElementById('tb-saved');
    if(ind) {
      ind.style.display = 'flex';
      clearTimeout(ind._timer);
      ind._timer = setTimeout(()=>{ ind.style.display='none'; }, 2500);
    }
    syncToSupabase();
  } catch(e) { console.warn('No se pudo guardar:', e); }
}

// ── Sincronización con Supabase ──────────────────────────────────────
function mostrarSyncEstado(texto, color) {
  const el = document.getElementById('tb-sync');
  const tx = document.getElementById('tb-sync-text');
  if (!el || !tx) return;
  el.style.display = 'flex';
  el.style.color = color || 'var(--blue2)';
  tx.textContent = texto;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function syncToSupabase() {
  if (typeof sb === 'undefined' || !empresaActual?.id) return;
  try {
    const payload = {
      empresa_id: empresaActual.id,
      equipos,
      mantenimientos,
      fallas,
      next_eq_id: nextEqId,
      next_mant_id: nextMantId,
      next_falla_id: nextFallaId
    };
    const { error } = await sb.from('sync_data').upsert(payload, { onConflict: 'empresa_id' });
    if (error) throw error;
    mostrarSyncEstado('☁️ En la nube', 'var(--green2)');
  } catch (e) {
    console.warn('SIMPOE: Error sync a Supabase:', e.message);
    mostrarSyncEstado('☁️ Sin conexión', 'var(--yellow2)');
  }
}

async function syncActivosToSupabase() {
  if (typeof sb === 'undefined' || !empresaActual?.id) return;
  try {
    const { data: existing } = await sb.from('sync_data').select('*').eq('empresa_id', empresaActual.id).single();
    const payload = {
      empresa_id: empresaActual.id,
      equipos: existing?.equipos || equipos,
      mantenimientos: existing?.mantenimientos || mantenimientos,
      fallas: existing?.fallas || fallas,
      activos: activosEmpresariales,
      next_eq_id: existing?.next_eq_id || nextEqId,
      next_mant_id: existing?.next_mant_id || nextMantId,
      next_falla_id: existing?.next_falla_id || nextFallaId,
      next_activo_id: nextActivoId
    };
    const { error } = await sb.from('sync_data').upsert(payload, { onConflict: 'empresa_id' });
    if (error) throw error;
  } catch (e) {
    console.warn('SIMPOE: Error sync activos a Supabase:', e.message);
  }
}

async function loadFromSupabase() {
  if (typeof sb === 'undefined' || !empresaActual?.id) return false;
  try {
    const { data, error } = await sb.from('sync_data').select('*').eq('empresa_id', empresaActual.id).maybeSingle();
    if (error) throw error;
    if (!data) return false;
    equipos = data.equipos || [];
    mantenimientos = data.mantenimientos || [];
    fallas = data.fallas || [];
    nextEqId = data.next_eq_id || (equipos.length ? Math.max(...equipos.map(e=>e.id)) + 1 : 1);
    nextMantId = data.next_mant_id || (mantenimientos.length ? Math.max(...mantenimientos.map(m=>m.id)) + 1 : 1);
    nextFallaId = data.next_falla_id || (fallas.length ? Math.max(...fallas.map(f=>f.id)) + 1 : 1);
    mostrarSyncEstado('☁️ Cargado de la nube', 'var(--blue2)');
    return true;
  } catch (e) {
    console.warn('SIMPOE: Error cargando de Supabase:', e.message);
    return false;
  }
}

async function loadActivosFromSupabase() {
  if (typeof sb === 'undefined' || !empresaActual?.id) return false;
  try {
    const { data, error } = await sb.from('sync_data').select('activos, next_activo_id').eq('empresa_id', empresaActual.id).maybeSingle();
    if (error) throw error;
    if (!data?.activos) return false;
    activosEmpresariales = data.activos;
    nextActivoId = data.next_activo_id || (activosEmpresariales.length ? Math.max(...activosEmpresariales.map(a=>a.id)) + 1 : 1);
    return true;
  } catch (e) {
    console.warn('SIMPOE: Error cargando activos de Supabase:', e.message);
    return false;
  }
}

async function cargarDatos() {
  try {
    const raw = localStorage.getItem(getEmpresaKey());
    if(!raw) {
      const loaded = await loadFromSupabase();
      if (loaded) {
        guardarDatos();
        return true;
      }
      seedDemoDataForEmpresa(); return true;
    }
    const d = JSON.parse(raw);
    if(d.equipos && Array.isArray(d.equipos)) {
      equipos        = d.equipos;
      mantenimientos = d.mantenimientos || [];
      fallas         = d.fallas         || [];
      nextEqId       = d.nextEqId    || (Math.max(...equipos.map(e=>e.id),0) + 1);
      nextMantId     = d.nextMantId  || (mantenimientos.length ? Math.max(...mantenimientos.map(m=>m.id)) + 1 : 1);
      nextFallaId    = d.nextFallaId || (fallas.length ? Math.max(...fallas.map(f=>f.id)) + 1 : 1);
      return true;
    }
    seedDemoDataForEmpresa();
    return true;
  } catch(e) { console.warn('No se pudo cargar datos:', e); }
  return false;
}

function seedDemoDataForEmpresa() {
  const tipo = getTipoEmpresa();
  if (tipo === 'transporte') {
    equipos = [
      { id:1, nombre:'Bus Urbano #101', tipo:'Bus / Vehículo', serie:'9BWZZZ377VT001101',
        horasRec:1000, horasDia:14, factor:1.3, horasAcum:780, ubicacion:'Patio Central',
        criticidad:'alta', notas:'Mercedes-Benz OF-1721, 45 pasajeros',
        extra:{ placa:'WUA-101', anio:'2018', 'chasis':'9BWZZZ377VT001101', 'motor-tipo':'Mercedes OM 924 Euro 5',
          capacidad:'45', combustible:'Diesel', km:'182400', 'km-ini':'170000',
          conductor:'Pedro Martínez', 'lic-conductor':'C2-884521', ruta:'Ruta 15 Norte',
          'horas-dia':'14', 'cond-op':'Urbana congestionada',
          frenos:'Requiere revisión', llantas:'Desgaste moderado', suspension:'Óptima', transmision:'Óptima',
          soat:'2026-08-15', tecno:'2026-07-01', poliza:'2026-09-01', 'tarj-op':'2026-12-01', 'lic-cond':'2027-03-10' } },
      { id:2, nombre:'Bus Urbano #102', tipo:'Bus / Vehículo', serie:'9BWZZZ377VT001102',
        horasRec:1000, horasDia:12, factor:1.1, horasAcum:340, ubicacion:'Patio Central',
        criticidad:'media', notas:'Mercedes-Benz OF-1721, 45 pasajeros',
        extra:{ placa:'WUA-102', anio:'2021', 'motor-tipo':'Mercedes OM 924 Euro 6',
          capacidad:'45', combustible:'Diesel', km:'95200', 'km-ini':'88000',
          conductor:'Luisa Cantillo', ruta:'Ruta 8 Sur', 'horas-dia':'12', 'cond-op':'Normal',
          frenos:'Óptimo', llantas:'Buen estado', suspension:'Óptima', transmision:'Óptima',
          soat:'2026-06-25', tecno:'2026-12-20', poliza:'2027-01-15', 'tarj-op':'2027-02-01', 'lic-cond':'2026-08-30' } },
      { id:3, nombre:'Buseta Escolar #205', tipo:'Bus / Vehículo', serie:'8YPVD15J6GA001205',
        horasRec:800, horasDia:6, factor:0.8, horasAcum:520, ubicacion:'Patio Norte',
        criticidad:'alta', notas:'Chevrolet NQR, 25 pasajeros',
        extra:{ placa:'SCH-205', anio:'2016', 'motor-tipo':'Chevrolet 4HK1 Euro 3',
          capacidad:'25', combustible:'Diesel', km:'245800', 'km-ini':'228000',
          conductor:'Pedro Martínez', ruta:'Ruta Escolar Norte', 'horas-dia':'6', 'cond-op':'Montañosa',
          frenos:'Crítico', llantas:'Cambio urgente', suspension:'Requiere revisión', transmision:'Requiere revisión',
          soat:'2026-06-30', tecno:'2026-06-22', poliza:'2026-07-10', 'tarj-op':'2026-08-01', 'lic-cond':'2026-09-15' } },
      { id:4, nombre:'Volqueta Carga #310', tipo:'Bus / Vehículo', serie:'93PBC2J7XKE001310',
        horasRec:1200, horasDia:9, factor:1.4, horasAcum:1050, ubicacion:'Patio Sur',
        criticidad:'media', notas:'Kenworth T370, capacidad 14 ton',
        extra:{ placa:'KEN-310', anio:'2015', 'motor-tipo':'Cummins ISL Euro 3',
          capacidad:'14000kg', combustible:'Diesel', km:'410500', 'km-ini':'385000',
          conductor:'Luisa Cantillo', ruta:'Carga Interurbana', 'horas-dia':'9', 'cond-op':'Alta intensidad',
          frenos:'Requiere revisión', llantas:'Desgaste moderado', suspension:'Óptima', transmision:'Óptima',
          soat:'2026-12-15', tecno:'2027-01-10', poliza:'2026-11-01', 'tarj-op':'2027-01-20', 'lic-cond':'2026-10-05' } },
    ];
    mantenimientos = [
      { id:1, equipoId:1, equipoNombre:'Bus Urbano #101', fecha:'2025-12-10', tipo:'Preventivo', desc:'Cambio de aceite y filtros, revisión general de 170.000 km', tecnico:'Pedro Martínez', costo:380000 },
      { id:2, equipoId:1, equipoNombre:'Bus Urbano #101', fecha:'2026-02-14', tipo:'Correctivo', desc:'Reparación de sistema de frenos por desgaste excesivo de pastillas', tecnico:'Taller Externo', costo:620000 },
      { id:3, equipoId:2, equipoNombre:'Bus Urbano #102', fecha:'2026-01-20', tipo:'Preventivo', desc:'Mantenimiento preventivo 88.000 km, rotación de llantas', tecnico:'Pedro Martínez', costo:290000 },
      { id:4, equipoId:3, equipoNombre:'Buseta Escolar #205', fecha:'2025-11-05', tipo:'Correctivo', desc:'Cambio de sistema de frenos completo por falla en ruta', tecnico:'Taller Externo', costo:890000 },
      { id:5, equipoId:3, equipoNombre:'Buseta Escolar #205', fecha:'2026-03-01', tipo:'Correctivo', desc:'Reparación de suspensión delantera por desgaste de amortiguadores', tecnico:'Pedro Martínez', costo:540000 },
      { id:6, equipoId:4, equipoNombre:'Volqueta Carga #310', fecha:'2026-01-08', tipo:'Preventivo', desc:'Mantenimiento 385.000 km, cambio de filtros y aceite hidráulico', tecnico:'Pedro Martínez', costo:450000 },
    ];
    nextEqId = 5; nextMantId = 7;
  } else if (tipo === 'industrial') {
    equipos = [
      { id:1, nombre:'Compresor Industrial CI-01', tipo:'Compresor', serie:'CMP-2019-0451',
        horasRec:2000, horasDia:16, factor:1.2, horasAcum:1680, ubicacion:'Planta A - Línea 1',
        criticidad:'alta', notas:'Atlas Copco GA75, 75kW',
        extra:{ 'cod-interno':'MQ-001', 'area-planta':'Línea 1 - Producción', 'tecnico-resp':'Andrés López',
          'eq-criticidad':'Alta — Producción crítica', 'cond-trabajo':'Polvo / Partículas',
          'horas-acum-ind':'1680', 'horas-ult-mant':'1200', vibracion:'5.2', temperatura:'82', 'temp-max':'95',
          'desgaste-ind':'Moderado — Monitorear', 'tiempo-det':'4', 'prod-pct':'78', 'nro-fallas':'2' } },
      { id:2, nombre:'Motor Eléctrico ME-04', tipo:'Motor', serie:'MOT-2020-1187',
        horasRec:3000, horasDia:20, factor:1.0, horasAcum:2150, ubicacion:'Planta A - Línea 2',
        criticidad:'media', notas:'WEG W22 30HP trifásico',
        extra:{ 'cod-interno':'MQ-002', 'area-planta':'Línea 2 - Empaque', 'tecnico-resp':'Diego Vargas',
          'eq-criticidad':'Media — Afecta parcialmente', 'cond-trabajo':'Normal',
          'horas-acum-ind':'2150', 'horas-ult-mant':'2000', vibracion:'2.1', temperatura:'68', 'temp-max':'90',
          'desgaste-ind':'Mínimo — Normal', 'tiempo-det':'0', 'prod-pct':'92', 'nro-fallas':'0' } },
      { id:3, nombre:'Bomba Centrífuga BC-02', tipo:'Bomba', serie:'BMB-2017-0823',
        horasRec:1500, horasDia:24, factor:1.5, horasAcum:1490, ubicacion:'Planta B - Bombeo',
        criticidad:'alta', notas:'Grundfos CR-15, sistema refrigeración',
        extra:{ 'cod-interno':'MQ-003', 'area-planta':'Planta B - Refrigeración', 'tecnico-resp':'Andrés López',
          'eq-criticidad':'Alta — Producción crítica', 'cond-trabajo':'Humedad / Vapor',
          'horas-acum-ind':'1490', 'horas-ult-mant':'1000', vibracion:'7.8', temperatura:'91', 'temp-max':'95',
          'desgaste-ind':'Avanzado — Programar mant.', 'tiempo-det':'12', 'prod-pct':'45', 'nro-fallas':'4' } },
      { id:4, nombre:'Generador de Emergencia GE-01', tipo:'Generador', serie:'GEN-2015-0034',
        horasRec:1000, horasDia:2, factor:0.6, horasAcum:180, ubicacion:'Subestación Eléctrica',
        criticidad:'media', notas:'Cummins 150KVA, respaldo eléctrico',
        extra:{ 'cod-interno':'MQ-004', 'area-planta':'Subestación', 'tecnico-resp':'Diego Vargas',
          'eq-criticidad':'Media — Afecta parcialmente', 'cond-trabajo':'Normal',
          'horas-acum-ind':'180', 'horas-ult-mant':'100', vibracion:'1.5', temperatura:'55', 'temp-max':'85',
          'desgaste-ind':'Mínimo — Normal', 'tiempo-det':'0', 'prod-pct':'100', 'nro-fallas':'0' } },
    ];
    mantenimientos = [
      { id:1, equipoId:1, equipoNombre:'Compresor Industrial CI-01', fecha:'2025-09-15', tipo:'Preventivo', desc:'Cambio de filtros de aire y aceite sintético a las 1200h', tecnico:'Andrés López', costo:420000 },
      { id:2, equipoId:1, equipoNombre:'Compresor Industrial CI-01', fecha:'2026-01-10', tipo:'Correctivo', desc:'Reparación de válvula de admisión por desgaste prematuro', tecnico:'Andrés López', costo:680000 },
      { id:3, equipoId:1, equipoNombre:'Compresor Industrial CI-01', fecha:'2026-04-02', tipo:'Correctivo', desc:'Ajuste de alineación por vibración anormal detectada en sensor', tecnico:'Técnico Externo', costo:350000 },
      { id:4, equipoId:2, equipoNombre:'Motor Eléctrico ME-04', fecha:'2026-02-18', tipo:'Preventivo', desc:'Lubricación de rodamientos y revisión eléctrica programada', tecnico:'Diego Vargas', costo:180000 },
      { id:5, equipoId:3, equipoNombre:'Bomba Centrífuga BC-02', fecha:'2025-10-01', tipo:'Preventivo', desc:'Cambio de sellos mecánicos a las 1000h de operación', tecnico:'Andrés López', costo:290000 },
      { id:6, equipoId:3, equipoNombre:'Bomba Centrífuga BC-02', fecha:'2025-12-20', tipo:'Correctivo', desc:'Reparación por sobrecalentamiento — falla en sistema de enfriamiento', tecnico:'Técnico Externo', costo:920000 },
      { id:7, equipoId:3, equipoNombre:'Bomba Centrífuga BC-02', fecha:'2026-03-15', tipo:'Correctivo', desc:'Cambio de rodamiento por vibración crítica detectada (7.8 mm/s)', tecnico:'Andrés López', costo:550000 },
      { id:8, equipoId:3, equipoNombre:'Bomba Centrífuga BC-02', fecha:'2026-05-01', tipo:'Predictivo', desc:'Análisis de vibración programado — seguimiento de tendencia', tecnico:'Andrés López', costo:95000 },
    ];
    nextEqId = 5; nextMantId = 9;
  } else if (tipo === 'construccion') {
    equipos = [
      { id:1, nombre:'Excavadora CAT 320', tipo:'Maquinaria Pesada', serie:'CAT0320DKMHF03291',
        horasRec:3000, horasDia:10, factor:1.3, horasAcum:2340, ubicacion:'Obra Torre Brisas',
        criticidad:'alta', notas:'Caterpillar 320D, 20 toneladas',
        extra:{ 'tipo-maq':'Excavadora', capacidad:'20 ton / 150 HP', operador:'Luis Moreno', 'lic-op':'LOP-2022-0145',
          'ub-obra':'Bloque C - Excavación', proyecto:'Torre Brisas del Mar',
          'horas-maq':'2340', 'horas-maq-ini':'2000', combustible:'Diesel', 'consumo-comb':'18.5',
          'nivel-trabajo':'Alta — Terreno difícil', turno:'2 turnos (16h/día)',
          'presion-hid':'215', 'pres-max':'250', temperatura:'88',
          'desg-estruc':'Desgaste leve — Normal', 'estado-hid':'Requiere revisión', 'nro-fallas':'1' } },
      { id:2, nombre:'Retroexcavadora JCB 3CX', tipo:'Maquinaria Pesada', serie:'JCB3CX2019007744',
        horasRec:2500, horasDia:8, factor:1.0, horasAcum:1180, ubicacion:'Obra Torre Brisas',
        criticidad:'media', notas:'JCB 3CX, uso mixto',
        extra:{ 'tipo-maq':'Retroexcavadora', capacidad:'8 ton / 100 HP', operador:'Carlos Builes',
          'ub-obra':'Bloque A - Cimentación', proyecto:'Torre Brisas del Mar',
          'horas-maq':'1180', 'horas-maq-ini':'1000', combustible:'Diesel', 'consumo-comb':'12.0',
          'nivel-trabajo':'Normal — Terreno plano', turno:'1 turno (8h/día)',
          'presion-hid':'180', 'pres-max':'230', temperatura:'75',
          'desg-estruc':'Sin daños — Óptimo', 'estado-hid':'Óptimo', 'nro-fallas':'0' } },
      { id:3, nombre:'Grúa Torre Liebherr', tipo:'Maquinaria Pesada', serie:'LBH2018003322',
        horasRec:5000, horasDia:12, factor:1.1, horasAcum:4200, ubicacion:'Obra Edificio Central',
        criticidad:'alta', notas:'Liebherr 132 EC-H, capacidad 8 ton',
        extra:{ 'tipo-maq':'Grúa', capacidad:'8 ton', operador:'Luis Moreno', 'lic-op':'LOP-2020-0078',
          'ub-obra':'Centro de Obra', proyecto:'Edificio Central Bocagrande',
          'horas-maq':'4200', 'horas-maq-ini':'3800', combustible:'Diesel', 'consumo-comb':'8.5',
          'nivel-trabajo':'Muy alta — Demolición/Roca', turno:'3 turnos (24h/día)',
          'presion-hid':'195', 'pres-max':'220', temperatura:'70',
          'desg-estruc':'Desgaste moderado — Monitorear', 'estado-hid':'Fuga detectada', 'nro-fallas':'3' } },
      { id:4, nombre:'Compactadora Bomag BW213', tipo:'Maquinaria Pesada', serie:'BMG2021009988',
        horasRec:2000, horasDia:6, factor:0.9, horasAcum:540, ubicacion:'Obra Torre Brisas',
        criticidad:'baja', notas:'Bomag BW213, rodillo vibratorio',
        extra:{ 'tipo-maq':'Compactadora', capacidad:'13 ton', operador:'Carlos Builes',
          'ub-obra':'Bloque B - Vías internas', proyecto:'Torre Brisas del Mar',
          'horas-maq':'540', 'horas-maq-ini':'400', combustible:'Diesel', 'consumo-comb':'9.2',
          'nivel-trabajo':'Normal — Terreno plano', turno:'1 turno (8h/día)',
          'presion-hid':'150', 'pres-max':'200', temperatura:'65',
          'desg-estruc':'Sin daños — Óptimo', 'estado-hid':'Óptimo', 'nro-fallas':'0' } },
    ];
    mantenimientos = [
      { id:1, equipoId:1, equipoNombre:'Excavadora CAT 320', fecha:'2025-11-12', tipo:'Preventivo', desc:'Cambio de aceite hidráulico y filtros a las 2000h', tecnico:'Luis Moreno', costo:780000 },
      { id:2, equipoId:1, equipoNombre:'Excavadora CAT 320', fecha:'2026-02-08', tipo:'Correctivo', desc:'Reparación de manguera hidráulica por fuga detectada en obra', tecnico:'Taller Externo', costo:450000 },
      { id:3, equipoId:2, equipoNombre:'Retroexcavadora JCB 3CX', fecha:'2025-12-01', tipo:'Preventivo', desc:'Mantenimiento programado 1000h, inspección estructural', tecnico:'Luis Moreno', costo:320000 },
      { id:4, equipoId:3, equipoNombre:'Grúa Torre Liebherr', fecha:'2025-08-20', tipo:'Preventivo', desc:'Inspección estructural certificada y lubricación general', tecnico:'Técnico Externo', costo:1200000 },
      { id:5, equipoId:3, equipoNombre:'Grúa Torre Liebherr', fecha:'2025-12-15', tipo:'Correctivo', desc:'Reparación de fuga en sistema hidráulico de elevación', tecnico:'Luis Moreno', costo:980000 },
      { id:6, equipoId:3, equipoNombre:'Grúa Torre Liebherr', fecha:'2026-03-22', tipo:'Correctivo', desc:'Reemplazo de cables de acero por desgaste detectado en inspección', tecnico:'Técnico Externo', costo:1450000 },
      { id:7, equipoId:4, equipoNombre:'Compactadora Bomag BW213', fecha:'2026-01-15', tipo:'Preventivo', desc:'Mantenimiento preventivo 400h, cambio de filtros', tecnico:'Luis Moreno', costo:280000 },
    ];
    nextEqId = 5; nextMantId = 8;
  }

  mantenimientos.forEach(m => {
    const eq = equipos.find(e=>e.id===m.equipoId);
    if (eq) m.equipoNombre = eq.nombre;
  });
  guardarDatos();
}

let activosEmpresariales = [];
let nextActivoId = 1;
let activoEditandoId = null;
let activoAccionId   = null;
const ACTIVOS_KEY_PREFIX = 'simpoe_activos_emp_';

function getActivosKey() {
  return ACTIVOS_KEY_PREFIX + (empresaActual?.id || 'global');
}

function guardarActivos() {
  try {
    localStorage.setItem(getActivosKey(), JSON.stringify({activosEmpresariales, nextActivoId}));
    syncActivosToSupabase();
  } catch(e){}
}

async function cargarActivos() {
  try {
    const raw = localStorage.getItem(getActivosKey());
    if (raw) {
      const d = JSON.parse(raw);
      activosEmpresariales = d.activosEmpresariales || [];
      nextActivoId = d.nextActivoId || (activosEmpresariales.length ? Math.max(...activosEmpresariales.map(a=>a.id))+1 : 1);
      return true;
    }
  } catch(e){}
  try {
    const loaded = await loadActivosFromSupabase();
    if (loaded) { guardarActivos(); return true; }
  } catch(e){}
  if (getTipoEmpresa() === 'activos') {
    seedDemoActivos();
    return true;
  }
  activosEmpresariales = []; nextActivoId = 1;
  return false;
}

function seedDemoActivos() {
  const hoy = new Date().toISOString().slice(0,10);
  activosEmpresariales = [
    { id:1, codigo:'ACT-00001', nombre:'Laptop Dell Latitude 5420', categoria:'Portátiles', marca:'Dell', modelo:'Latitude 5420',
      serial:'DLL-2023-04471', estado:'operativo', sede:'Sede Principal', area:'Sistemas', oficina:'Oficina 301',
      responsable:'Ricardo Núñez', fechaCompra:'2023-03-15', garantia:'2026-03-15', proveedor:'Compumax S.A.S', costo:3200000,
      obs:'Asignado para desarrollo de software', movimientos:[],
      historial:[{fecha:'2023-03-15',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'}], createdAt:'2023-03-15' },
    { id:2, codigo:'ACT-00002', nombre:'Computador de Escritorio HP ProDesk', categoria:'Computadores', marca:'HP', modelo:'ProDesk 600 G6',
      serial:'HP-2022-08832', estado:'operativo', sede:'Sede Principal', area:'Recursos Humanos', oficina:'Oficina 105',
      responsable:'María López', fechaCompra:'2022-06-10', garantia:'2025-06-10', proveedor:'Tecnoglobal Ltda', costo:2400000,
      obs:'', movimientos:[],
      historial:[{fecha:'2022-06-10',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'}], createdAt:'2022-06-10' },
    { id:3, codigo:'ACT-00003', nombre:'Impresora Multifuncional Epson L5290', categoria:'Impresoras', marca:'Epson', modelo:'L5290',
      serial:'EPS-2021-03311', estado:'mantenimiento', sede:'Sede Principal', area:'Administración', oficina:'Recepción',
      responsable:'Carlos Tovar', fechaCompra:'2021-09-20', garantia:'2024-09-20', proveedor:'Compumax S.A.S', costo:980000,
      obs:'En mantenimiento por atasco de papel recurrente', movimientos:[],
      historial:[{fecha:'2021-09-20',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'},
                 {fecha:'2026-05-10',tipo:'edicion',desc:'Estado: mantenimiento',usuario:'Ricardo Núñez'}], createdAt:'2021-09-20' },
    { id:4, codigo:'ACT-00004', nombre:'Servidor Dell PowerEdge R440', categoria:'Servidores', marca:'Dell', modelo:'PowerEdge R440',
      serial:'DLL-2020-00091', estado:'operativo', sede:'Sede Principal', area:'Sistemas', oficina:'Centro de Datos',
      responsable:'Ricardo Núñez', fechaCompra:'2020-01-12', garantia:'2025-01-12', proveedor:'Tecnoglobal Ltda', costo:18500000,
      obs:'Servidor principal de bases de datos', movimientos:[],
      historial:[{fecha:'2020-01-12',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'}], createdAt:'2020-01-12' },
    { id:5, codigo:'ACT-00005', nombre:'Silla Ergonómica Herman Miller', categoria:'Sillas', marca:'Herman Miller', modelo:'Aeron',
      serial:'', estado:'operativo', sede:'Sede Norte', area:'Gerencia', oficina:'Oficina Gerencial',
      responsable:'Diana Cortés', fechaCompra:'2023-11-05', garantia:'2028-11-05', proveedor:'Office Solutions', costo:4800000,
      obs:'', movimientos:[{fecha:'2024-02-01',sedePrev:'Sede Principal',sede:'Sede Norte',responsable:'Diana Cortés',motivo:'Reubicación gerencial',usuario:'Diana Cortés'}],
      historial:[{fecha:'2023-11-05',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'},
                 {fecha:'2024-02-01',tipo:'movimiento',icono:'🔄',desc:'Transferido de Sede Principal a Sede Norte',usuario:'Diana Cortés'}], createdAt:'2023-11-05' },
    { id:6, codigo:'ACT-00006', nombre:'Aire Acondicionado LG Inverter', categoria:'Aires Acondicionados', marca:'LG', modelo:'Dual Inverter 18000 BTU',
      serial:'LG-2022-77410', estado:'dañado', sede:'Sede Norte', area:'Administración', oficina:'Sala de Juntas',
      responsable:'', fechaCompra:'2022-04-18', garantia:'2025-04-18', proveedor:'Climatec S.A.S', costo:2100000,
      obs:'Fuga de gas refrigerante detectada, pendiente reparación', movimientos:[],
      historial:[{fecha:'2022-04-18',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'},
                 {fecha:'2026-04-22',tipo:'edicion',desc:'Estado: dañado — Fuga de gas detectada',usuario:'Ricardo Núñez'}], createdAt:'2022-04-18' },
    { id:7, codigo:'ACT-00007', nombre:'Router Cisco Catalyst 2960', categoria:'Routers', marca:'Cisco', modelo:'Catalyst 2960-X',
      serial:'CSC-2021-55029', estado:'operativo', sede:'Sede Principal', area:'Sistemas', oficina:'Centro de Datos',
      responsable:'Ricardo Núñez', fechaCompra:'2021-07-08', garantia:'2024-07-08', proveedor:'Tecnoglobal Ltda', costo:3600000,
      obs:'Core de red principal', movimientos:[],
      historial:[{fecha:'2021-07-08',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'}], createdAt:'2021-07-08' },
    { id:8, codigo:'ACT-00008', nombre:'Cámara de Seguridad Hikvision', categoria:'Cámaras', marca:'Hikvision', modelo:'DS-2CD2143G0',
      serial:'HKV-2023-19284', estado:'operativo', sede:'Sede Norte', area:'Seguridad', oficina:'Entrada Principal',
      responsable:'', fechaCompra:'2023-08-22', garantia:'2025-08-22', proveedor:'Seguritec Ltda', costo:650000,
      obs:'Sin responsable asignado aún', movimientos:[],
      historial:[{fecha:'2023-08-22',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'}], createdAt:'2023-08-22' },
    { id:9, codigo:'ACT-00009', nombre:'UPS APC Smart-UPS 1500VA', categoria:'UPS', marca:'APC', modelo:'Smart-UPS 1500',
      serial:'APC-2020-66103', estado:'operativo', sede:'Sede Principal', area:'Sistemas', oficina:'Centro de Datos',
      responsable:'Ricardo Núñez', fechaCompra:'2020-05-30', garantia:'2023-05-30', proveedor:'Tecnoglobal Ltda', costo:1800000,
      obs:'Respaldo eléctrico para servidor principal', movimientos:[],
      historial:[{fecha:'2020-05-30',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'}], createdAt:'2020-05-30' },
    { id:10, codigo:'ACT-00010', nombre:'Escritorio Ejecutivo en L', categoria:'Escritorios', marca:'Rimax', modelo:'Línea Ejecutiva',
      serial:'', estado:'baja', sede:'Sede Principal', area:'Administración', oficina:'Bodega',
      responsable:'', fechaCompra:'2018-02-14', garantia:'2020-02-14', proveedor:'Office Solutions', costo:850000,
      obs:'', motivoBaja:'Obsolescencia tecnológica', obsBaja:'Mueble deteriorado, reemplazado por nuevo modelo', fechaBaja:'2025-09-01',
      movimientos:[],
      historial:[{fecha:'2018-02-14',tipo:'registro',desc:'Activo registrado en el sistema',usuario:'Diana Cortés'},
                 {fecha:'2025-09-01',tipo:'baja',desc:'Dado de baja. Motivo: Obsolescencia tecnológica',usuario:'Diana Cortés'}], createdAt:'2018-02-14' },
  ];
  nextActivoId = 11;
  guardarActivos();
}

let fallas = [];
let nextFallaId = 1;

function exportarCSV(data, columns, filename) {
  const header = columns.map(c=>c.label).join(',');
  const rows   = data.map(row =>
    columns.map(c => {
      const val = String(row[c.key] || '').replace(/,/g,'').replace(/\n/g,' ');
      return `"${val}"`;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast('📥 Exportado', `${filename} descargado`, 'green');
}

function exportarHistorial() {
  exportarCSV(mantenimientos, [
    {key:'id',label:'ID'},{key:'equipoNombre',label:'Equipo'},{key:'tipo',label:'Tipo'},
    {key:'fecha',label:'Fecha'},{key:'tecnico',label:'Técnico'},{key:'costo',label:'Costo COP'},
    {key:'desc',label:'Descripción'},
  ], `SIMPOE_historial_${new Date().toISOString().slice(0,10)}.csv`);
}

function exportarFallas() {
  exportarCSV(fallas, [
    {key:'id',label:'ID'},{key:'equipoNombre',label:'Equipo'},{key:'fecha',label:'Fecha'},
    {key:'urgencia',label:'Urgencia'},{key:'estado',label:'Estado'},{key:'area',label:'Área'},
    {key:'reportadoPor',label:'Reportado por'},{key:'desc',label:'Descripción'},
  ], `SIMPOE_fallas_${new Date().toISOString().slice(0,10)}.csv`);
}

function exportarEquipos() {
  const data = equipos.map(eq => {
    const c = calcEquipo(eq);
    return {...eq, saludPct: c.saludPct, diasMantenimiento: c.diasMantenimiento, estado: c.estado};
  });
  exportarCSV(data, [
    {key:'codigo',label:'Código'},{key:'nombre',label:'Nombre'},{key:'tipo',label:'Tipo'},
    {key:'fabricante',label:'Fabricante'},{key:'modelo',label:'Modelo'},{key:'serie',label:'N° Serie'},
    {key:'ubicacion',label:'Ubicación'},{key:'criticidad',label:'Criticidad'},
    {key:'horasRec',label:'Hrs Rec.'},{key:'horasDia',label:'Hrs/Día'},{key:'factor',label:'Factor'},
    {key:'horasAcum',label:'Hrs Acum.'},{key:'saludPct',label:'Salud %'},
    {key:'diasMantenimiento',label:'Días p/Mant.'},{key:'estado',label:'Estado'},
  ], `SIMPOE_equipos_${new Date().toISOString().slice(0,10)}.csv`);
}

function exportarActivosCSV() {
  const headers = ['Código','Nombre','Categoría','Marca','Modelo','Serial','Estado','Sede','Área','Oficina',
                   'Responsable','Fecha Compra','Garantía','Proveedor','Costo COP','Movimientos','Observaciones'];
  const rows = activosEmpresariales.map(a=>[
    a.codigo,a.nombre,a.categoria,a.marca,a.modelo,a.serial,a.estado,
    a.sede,a.area,a.oficina,a.responsable,a.fechaCompra,a.garantia,a.proveedor,a.costo,
    (a.movimientos||[]).length,a.obs
  ].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));
  const csv=[headers.join(','),...rows].join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url; link.download=`SIMPOE_Activos_${new Date().toISOString().slice(0,10)}.csv`; link.click();
  URL.revokeObjectURL(url);
  toast('📥 Exportado',`${activosEmpresariales.length} activos exportados`,'green');
}

// ══════════════════════════════════════════════
//  AUTENTICACIÓN — Supabase + fallback local
// ══════════════════════════════════════════════

/**
 * Intenta autenticar con Supabase. Si no está disponible,
 * valida contra la lista local de usuarios (DEFAULT_USERS).
 * Establece currentUser y empresaActual al éxito.
 * Lanza un Error si las credenciales son incorrectas.
 */
async function loginWithSupabase(email, pass) {
  // ── 1. Intentar con Supabase ──────────────────────────────
  try {
    if (typeof sb !== 'undefined') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (!error && data?.user) {
        const meta = data.user.user_metadata || {};
        const empresaId = meta.empresa_id ?? null;
        currentUser = {
          id:        data.user.id,
          email:     data.user.email,
          nombre:    meta.nombre || data.user.email.split('@')[0],
          role:      meta.role   || 'operador',
          empresaId: empresaId,
        };
        empresaActual = empresaId ? (empresas.find(e => e.id === empresaId) || null) : null;
        await cargarDatos();
        return;
      }
      // Supabase devolvió error de credenciales explícito → no hacer fallback
      if (error && (
        error.message?.toLowerCase().includes('invalid') ||
        error.message?.toLowerCase().includes('credentials') ||
        error.message?.toLowerCase().includes('password')
      )) {
        throw new Error('Credenciales incorrectas');
      }
    }
  } catch (supabaseErr) {
    if (supabaseErr.message === 'Credenciales incorrectas') throw supabaseErr;
    // Red caída o Supabase no configurado → fallback local
    console.warn('SIMPOE: Supabase no disponible, usando login local.', supabaseErr.message);
  }

  // ── 2. Fallback: autenticación local ─────────────────────
  const found = usuarios.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.pass === pass
  );
  if (!found) throw new Error('Credenciales incorrectas');

  currentUser = {
    id:        found.id,
    email:     found.email,
    nombre:    found.nombre,
    role:      found.role,
    empresaId: found.empresaId ?? null,
  };
  empresaActual = found.empresaId ? (empresas.find(e => e.id === found.empresaId) || null) : null;
  await cargarDatos();
}

/**
 * Cierra la sesión de Supabase (si existe) y limpia currentUser.
 */
async function logoutFromSupabase() {
  try {
    if (typeof sb !== 'undefined') await sb.auth.signOut();
  } catch (e) {
    console.warn('SIMPOE: Error cerrando sesión en Supabase.', e);
  }
  currentUser   = null;
  empresaActual = null;
}

/**
 * Comprueba si ya hay una sesión activa en Supabase.
 * Si la hay, restaura currentUser y retorna true.
 */
async function initSession() {
  try {
    if (typeof sb !== 'undefined') {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user) {
        const u    = data.session.user;
        const meta = u.user_metadata || {};
        const empresaId = meta.empresa_id ?? null;
        currentUser = {
          id:        u.id,
          email:     u.email,
          nombre:    meta.nombre || u.email.split('@')[0],
          role:      meta.role   || 'operador',
          empresaId: empresaId,
        };
        empresaActual = empresaId ? (empresas.find(e => e.id === empresaId) || null) : null;
        await cargarDatos();
        return true;
      }
    }
  } catch (e) {
    console.warn('SIMPOE: No se pudo verificar sesión de Supabase.', e);
  }
  return false;
}
