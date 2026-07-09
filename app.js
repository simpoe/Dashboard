// ══════════════════════════════════════════════
//  SISTEMA DE USUARIOS Y ROLES
// ══════════════════════════════════════════════



// Carga usuarios desde localStorage o usa los por defecto
// alias legacy



// ── Login helpers ──
function quickLogin(email, pass) {
  document.getElementById('li-email').value = email;
  document.getElementById('li-pass').value  = pass;
  doLogin();
}

async function doLogin() {
  const email = (document.getElementById('li-email').value || '').trim().toLowerCase();
  const pass  = (document.getElementById('li-pass').value  || '').trim();
  const errEl = document.getElementById('login-error');

  if (!email || !pass) {
    errEl.textContent = '⚠️ Completa correo y contraseña.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Ingresando...';

  try {
    await loginWithSupabase(email, pass);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
    errEl.textContent = '❌ Correo o contraseña incorrectos.';
    errEl.style.display = 'block';
    errEl.style.animation = 'none';
    void errEl.offsetWidth;
    errEl.style.animation = 'shake .3s ease';
    document.getElementById('li-pass').value = '';
    return;
  }

  btn.disabled = false;
  btn.textContent = 'Ingresar';
  errEl.style.display = 'none';
  const user = currentUser;

  // Generar iniciales dinámicas
  const initials = user.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('tb-avatar').textContent = initials;
  document.getElementById('tb-avatar').style.background = user.role === 'admin'
    ? 'linear-gradient(135deg,var(--blue),var(--purple))'
    : 'linear-gradient(135deg,var(--cyan),var(--blue))';
  document.getElementById('tb-name').textContent = user.nombre;
  const roleBadge = document.getElementById('tb-role-badge');
  if (roleBadge) {
    const rl = {superadmin:'🌐 Super Admin', admin:'👑 Admin', tecnico:'🔧 Técnico', operador:'⚠️ Operador'};
    roleBadge.textContent = rl[user.role] || user.role;
    roleBadge.style.color = user.role==='superadmin'?'var(--purple2)': user.role==='admin'?'var(--purple2)':'var(--green2)';
  }

  const empBadge = document.getElementById('tb-empresa');
  if (empBadge) {
    if (user.role === 'superadmin') {
      empBadge.textContent = '🌐 Todas las empresas';
      empBadge.style.color = 'var(--purple2)';
    } else if (empresaActual) {
      empBadge.textContent = '🏢 ' + empresaActual.nombre;
      empBadge.style.color = empresaActual.color || 'var(--blue2)';
    }
  }

  aplicarRol(user.role);

  const ls = document.getElementById('login-screen');
  ls.style.opacity = '0';
  setTimeout(() => {
    ls.style.display = 'none';
    renderDashboard();
    updateBadges();
    const rolLabel = {superadmin:'🌐 Super Admin', admin:'👑 Admin', tecnico:'🔧 Técnico', operador:'⚠️ Operador'};
    const empLabel = empresaActual ? ` · ${empresaActual.nombre}` : ' · Acceso global';
    toast(`👋 Bienvenido`, `${user.nombre} — ${rolLabel[user.role]||user.role}${empLabel}`, 'green');
  }, 400);
}

async function doLogout() {
  await logoutFromSupabase();
  equipos = []; mantenimientos = []; fallas = []; activosEmpresariales = [];
  nextEqId = 1; nextMantId = 1; nextFallaId = 1;
  const empBadge = document.getElementById('tb-empresa');
  if (empBadge) empBadge.textContent = '';
  document.getElementById('li-email').value = '';
  document.getElementById('li-pass').value  = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('tb-avatar').textContent = '?';
  document.getElementById('tb-avatar').style.background = 'linear-gradient(135deg,var(--blue),var(--cyan))';
  document.getElementById('tb-name').textContent = '—';
  const rb = document.getElementById('tb-role-badge');
  if (rb) rb.textContent = '';
  aplicarRol(null);
  const ls = document.getElementById('login-screen');
  ls.style.opacity = '0';
  ls.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ls.style.transition = 'opacity .35s';
    ls.style.opacity = '1';
  }));
}

// ── Control de acceso por rol ──
function aplicarRol(role) {
  const navUsuarios    = document.getElementById('nav-usuarios');
  const navUsuariosSec = document.getElementById('nav-sec-admin');
  const navEmpresas    = document.getElementById('nav-empresas');
  const allOps = ['nav-ia','nav-calculo',
                  'nav-alertas','nav-historial','nav-mantenimiento','nav-reporte','nav-equipos','nav-fallas'];
  const show = id => { const el=document.getElementById(id); if(el) el.style.display='flex'; };
  const hide = id => { const el=document.getElementById(id); if(el) el.style.display='none'; };

  const navActivos = document.getElementById('nav-activos');
  const btnEq = document.getElementById('btn-nuevo-equipo');
  const isActivos = getTipoEmpresa() === 'activos';
  if (role === 'superadmin') {
    if (navUsuarios)    navUsuarios.style.display    = 'flex';
    if (navUsuariosSec) navUsuariosSec.style.display = 'block';
    if (navEmpresas)    navEmpresas.style.display    = 'flex';
    allOps.forEach(hide);
    if (navActivos) navActivos.style.display = 'none';
    if (btnEq) btnEq.style.display = 'none';
  } else {
    if (btnEq) btnEq.style.display = 'inline-flex';
    if (role === 'admin') {
      if (navUsuarios)    navUsuarios.style.display    = 'flex';
      if (navUsuariosSec) navUsuariosSec.style.display = 'block';
      if (navEmpresas)    navEmpresas.style.display    = 'none';
      allOps.forEach(show);
      if (navActivos) navActivos.style.display = isActivos ? 'flex' : 'none';
    } else if (role === 'tecnico') {
      if (navUsuarios)    navUsuarios.style.display    = 'none';
      if (navUsuariosSec) navUsuariosSec.style.display = 'none';
      if (navEmpresas)    navEmpresas.style.display    = 'none';
      allOps.forEach(show);
      if (navActivos) navActivos.style.display = isActivos ? 'flex' : 'none';
    } else if (role === 'operador') {
      if (navUsuarios)    navUsuarios.style.display    = 'none';
      if (navUsuariosSec) navUsuariosSec.style.display = 'none';
      if (navEmpresas)    navEmpresas.style.display    = 'none';
      ['nav-equipos','nav-calculo','nav-ia','nav-alertas',
       'nav-historial','nav-mantenimiento','nav-reporte'].forEach(hide);
      show('nav-fallas');
      if (getTipoEmpresa()==='activos') show('nav-activos'); else hide('nav-activos');
    } else {
      if (navUsuarios)    navUsuarios.style.display    = 'none';
      if (navUsuariosSec) navUsuariosSec.style.display = 'none';
      if (navEmpresas)    navEmpresas.style.display    = 'none';
      allOps.forEach(hide);
    }
  }
}

function goViewSeguro(view, el) {
  const role = currentUser?.role;
  if (view === 'empresas' && role !== 'superadmin') {
    toast('🔒 Solo Super Admin', 'Exclusivo del administrador global del sistema', 'red'); return;
  }
  if (view === 'usuarios' && role !== 'admin' && role !== 'superadmin') {
    toast('🔒 Acceso restringido', 'Solo administradores pueden gestionar usuarios', 'red'); return;
  }
  if (role === 'operador' && !['dashboard','fallas'].includes(view)) {
    toast('🔒 Acceso restringido', 'Tu rol solo permite reportar fallas de equipos', 'red'); return;
  }
  if (role === 'superadmin' && !['dashboard','empresas','usuarios'].includes(view)) {
    toast('🔒 Solo Administración', 'El Super Admin no tiene acceso a funciones operativas', 'red'); return;
  }
  goView(view, el);
}

document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('li-email').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('li-pass').focus(); });
document.getElementById('li-pass').addEventListener('keydown',  e => { if(e.key==='Enter') doLogin(); });

// ── Auto-login si hay sesión activa en Supabase ──
(async function initApp() {
  try {
    const hasSession = await initSession();
    if (hasSession && currentUser) {
      const user = currentUser;
      const initials = user.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      document.getElementById('tb-avatar').textContent = initials;
      document.getElementById('tb-avatar').style.background = user.role === 'admin'
        ? 'linear-gradient(135deg,#0ea5e9,#0ea5e9)'
        : 'linear-gradient(135deg,var(--blue),var(--cyan))';
      document.getElementById('tb-name').textContent = user.nombre;
      const roleBadge = document.getElementById('tb-role-badge');
      if (roleBadge) {
        const rl = {superadmin:'🌐 Super Admin', admin:'👑 Admin', tecnico:'🔧 Técnico', operador:'⚠️ Operador'};
        roleBadge.textContent = rl[user.role] || user.role;
        roleBadge.style.color = user.role==='superadmin'?'var(--purple2)': user.role==='admin'?'var(--purple2)':'var(--green2)';
      }
      const empBadge = document.getElementById('tb-empresa');
      if (empBadge) {
        if (user.role === 'superadmin') {
          empBadge.textContent = '🌐 Todas las empresas';
          empBadge.style.color = 'var(--purple2)';
        } else if (empresaActual) {
          empBadge.textContent = '🏢 ' + empresaActual.nombre;
          empBadge.style.color = empresaActual.color || 'var(--blue2)';
        }
      }
      aplicarRol(user.role);
      const ls = document.getElementById('login-screen');
      ls.style.display = 'none';
      renderDashboard();
      updateBadges();
    }
  } catch (e) {
    console.warn('Init session check:', e);
  }
})();

// ══════════════════════════════════════════════
//  CÁLCULO CORE — Con fórmula correcta
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  HELPERS VISUALES
// ══════════════════════════════════════════════
const sC  = s => s>70?'var(--green)':s>40?'var(--yellow)':'var(--red)';
const sC2 = s => s>70?'var(--green2)':s>40?'var(--yellow2)':'var(--red2)';
const dC  = d => d<=3?'var(--red2)':d<=10?'var(--yellow2)':'var(--green2)';

function badge(estado) {
  const m = { ok:['b-ok','✅ OK'], warn:['b-warn','⚠️ Atención'], crit:['b-crit','🔴 Urgente'] };
  const [c,t] = m[estado]||['b-ok','OK'];
  return `<span class="badge ${c}"><span class="badge-dot"></span>${t}</span>`;
}

function pb(val,max=100) {
  const p = Math.min(100,Math.round((val/max)*100));
  return `<div class="pb-wrap"><div class="pb-track"><div class="pb-fill" style="width:${p}%;background:${sC(p)}"></div></div><span class="pb-val" style="color:${sC(p)}">${p}%</span></div>`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
}

function fmtCop(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

// ══════════════════════════════════════════════
//  CLOCK
// ══════════════════════════════════════════════
function updateClock() {
  const el = document.getElementById('tb-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
setInterval(updateClock,1000); updateClock();

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
function toggleSidebar() {
  const s = document.querySelector('.sidebar'), o = document.querySelector('.sidebar-overlay');
  s.classList.toggle('open'); o.classList.toggle('open');
}

function goView(view, el) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  el.classList.add('active');
  const s = document.querySelector('.sidebar');
  if (s.classList.contains('open')) { s.classList.remove('open'); document.querySelector('.sidebar-overlay').classList.remove('open'); }
  const renders = {
    dashboard:renderDashboard, equipos:renderEquipos, calculo:renderCalculo, ia:renderIA,
    alertas:renderAlertas, historial:renderHistorial, mantenimiento:renderMantenimientoView,
    reporte:renderReporte, usuarios:renderUsuarios, fallas:renderFallas,
    empresas:renderEmpresas, activos:renderActivos
  };
  if (renders[view]) renders[view]();
  updateBadges();
}

function updateBadges() {
  const crits = equipos.filter(e=>calcEquipo(e).estado!=='ok').length;
  const ba = document.getElementById('badge-alertas');
  if (ba) { ba.textContent=crits; ba.style.display=crits>0?'inline-flex':'none'; }
  const bh = document.getElementById('badge-historial');
  if (bh) bh.textContent = mantenimientos.length;
  // IA badge
  const iaCount = equipos.reduce((s,eq)=>{
    const c=calcEquipo(eq); let r=0;
    if(c.saludPct<=60) r++;
    if(eq.factor>=1.5) r++;
    const nc=mantenimientos.filter(m=>m.equipoId===eq.id&&m.tipo==='Correctivo').length;
    const np=mantenimientos.filter(m=>m.equipoId===eq.id&&m.tipo==='Preventivo').length;
    if(nc>np&&nc>0) r++;
    return s+r;
  },0);
  const bi = document.getElementById('badge-ia');
  if (bi) { bi.textContent=iaCount; bi.style.display=iaCount>0?'inline-flex':'none'; }
  // Usuarios badge
  const bu = document.getElementById('badge-usuarios');
  if (bu) bu.textContent = usuarios.filter(u=> empresaActual ? u.empresaId===empresaActual.id : true).length;
  // Empresas badge (superadmin)
  const be = document.getElementById('badge-empresas');
  if (be) be.textContent = empresas.length;
  const ba2 = document.getElementById('badge-activos');
  if (ba2) ba2.textContent = activosEmpresariales.filter(a=>a.estado!=='baja').length;
  // Fallas badge — fallas pendientes
  const bf = document.getElementById('badge-fallas');
  if (bf) {
    const pendientes = fallas.filter(f=>f.estado!=='resuelta').length;
    bf.textContent = pendientes;
    bf.style.display = pendientes>0?'inline-flex':'none';
  }
}

// ══════════════════════════════════════════════
//  GESTIÓN DE USUARIOS (SOLO ADMIN)
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  GESTIÓN DE EMPRESAS (SOLO SUPERADMIN)
// ══════════════════════════════════════════════
function renderEmpresas() {
  if (!currentUser || currentUser.role !== 'superadmin') return;

  const statsEl = document.getElementById('emp-stats');
  if (statsEl) {
    const activas = empresas.filter(e=>e.activa).length;
    const totalUsr = usuarios.filter(u=>u.role!=='superadmin').length;
    const totalEq  = 0; // Cross-company count would need all keys
    statsEl.innerHTML = `
      <div class="stat-card blue"><div class="stat-icon">🏢</div><div class="stat-value">${empresas.length}</div><div class="stat-label">Empresas Registradas</div><div class="stat-sub">${activas} activas</div></div>
      <div class="stat-card green"><div class="stat-icon">👥</div><div class="stat-value">${totalUsr}</div><div class="stat-label">Usuarios Totales</div><div class="stat-sub">Sin contar Super Admin</div></div>
      <div class="stat-card yellow"><div class="stat-icon">✅</div><div class="stat-value">${activas}</div><div class="stat-label">Empresas Activas</div><div class="stat-sub">Con acceso al sistema</div></div>
      <div class="stat-card purple"><div class="stat-icon">🔒</div><div class="stat-value">${empresas.length - activas}</div><div class="stat-label">Desactivadas</div><div class="stat-sub">Sin acceso al sistema</div></div>`;
  }

  const cardsEl = document.getElementById('emp-cards');
  if (!cardsEl) return;

  if (!empresas.length) {
    cardsEl.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🏢</div><p>No hay empresas registradas. Crea la primera empresa.</p></div>';
    return;
  }

  cardsEl.innerHTML = empresas.map(emp => {
    const empUsers = usuarios.filter(u=>u.empresaId===emp.id);
    const admins   = empUsers.filter(u=>u.role==='admin').length;
    const tecnicos = empUsers.filter(u=>u.role==='tecnico').length;
    return `
      <div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;position:relative;transition:all .2s;" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="height:5px;background:${emp.color||'var(--blue)'}"></div>
        <div style="padding:18px">
          <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
            <div style="width:48px;height:48px;border-radius:12px;background:${emp.color||'var(--blue)'};display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:800;color:#fff;flex-shrink:0">${emp.logoText||emp.nombre.slice(0,2).toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-weight:800;font-size:.95rem;margin-bottom:2px">${emp.nombre}</div>
              <div style="font-size:.75rem;color:var(--text3)">${SECTOR_CONFIG[emp.tipo]?.icono||'🏢'} ${SECTOR_CONFIG[emp.tipo]?.nombre||emp.tipo||'—'} · ${emp.ciudad||'—'}</div>
          ${emp.responsable?`<div style="font-size:.72rem;color:var(--text3);margin-top:2px">👤 ${emp.responsable}</div>`:''}

              <div style="margin-top:5px">
                <span class="badge ${emp.activa?'b-ok':'b-crit'}" style="font-size:.68rem">${emp.activa?'✅ Activa':'🔴 Inactiva'}</span>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
            <div class="kv-row cls-kv-compact"><span class="kv-key">NIT</span><span class="kv-val" style="font-family:var(--mono)">${emp.nit||'—'}</span></div>
            <div class="kv-row cls-kv-compact"><span class="kv-key">Usuarios</span><span class="kv-val">${empUsers.length}</span></div>
            <div class="kv-row cls-kv-compact"><span class="kv-key">Admins</span><span class="kv-val">${admins}</span></div>
            <div class="kv-row cls-kv-compact"><span class="kv-key">Técnicos</span><span class="kv-val">${tecnicos}</span></div>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-xs" onclick="verEmpresa(${emp.id})">🔍 Ver detalle</button>
            <button class="btn btn-primary btn-xs" onclick="agregarUsuarioEmpresa(${emp.id})">➕ Agregar Usuario</button>
            <button class="btn ${emp.activa?'btn-danger':'btn-success'} btn-xs" onclick="toggleEmpresa(${emp.id})">${emp.activa?'🔴 Desactivar':'✅ Activar'}</button>
            <button class="btn btn-danger btn-xs" onclick="eliminarEmpresa(${emp.id})" title="Eliminar empresa permanentemente">🗑 Eliminar</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function crearEmpresa() {
  if (!currentUser || currentUser.role !== 'superadmin') return;

  const nombre       = document.getElementById('ne-nombre').value.trim();
  const nit          = document.getElementById('ne-nit').value.trim();
  const responsable  = document.getElementById('ne-responsable').value.trim();
  const ciudad       = document.getElementById('ne-ciudad').value.trim();
  const pais         = document.getElementById('ne-pais').value.trim() || 'Colombia';
  const tel          = document.getElementById('ne-telefono').value.trim();
  const emailEmp     = document.getElementById('ne-email').value.trim();
  const color        = document.getElementById('ne-color').value;
  const logo         = document.getElementById('ne-logo').value.trim().toUpperCase();
  const tipo         = document.getElementById('ne-tipo-empresa').value || 'industrial';

  const adminNombre  = document.getElementById('ne-admin-nombre').value.trim();
  const adminEmail   = document.getElementById('ne-admin-email').value.trim().toLowerCase();
  const adminPass    = document.getElementById('ne-admin-pass').value;
  const adminPass2   = document.getElementById('ne-admin-pass2').value;

  const errEl = document.getElementById('ne-error');
  const error = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!nombre)      return error('⚠️ Ingresa el nombre de la empresa.');
  if (!nit)         return error('⚠️ Ingresa el NIT de la empresa.');
  if (!responsable) return error('⚠️ Ingresa el nombre del responsable.');
  if (!ciudad)      return error('⚠️ Ingresa la ciudad.');
  if (!tipo)        return error('⚠️ Selecciona el tipo de empresa.');
  if (empresas.find(e => e.nit === nit))
                    return error('⚠️ Ya existe una empresa con ese NIT.');
  if (!adminNombre)                       return error('⚠️ Ingresa el nombre del administrador.');
  if (!adminEmail || !adminEmail.includes('@'))
                                          return error('⚠️ Ingresa un correo válido para el administrador.');
  if (usuarios.find(u => u.email === adminEmail))
                                          return error('⚠️ Ya existe un usuario con ese correo.');
  if (!adminPass || adminPass.length < 4) return error('⚠️ La contraseña debe tener al menos 4 caracteres.');
  if (adminPass !== adminPass2)           return error('⚠️ Las contraseñas no coinciden.');

  const newEmpresaId = nextEmpresaId++;

  // Crear auth user en Supabase
  try {
    const { data: authData, error: authErr } = await sb.auth.signUp({
      email: adminEmail, password: adminPass,
      options: { data: { nombre: adminNombre, role: 'admin', empresa_id: newEmpresaId } }
    });
    if (authErr) {
      if (authErr.message?.includes('security') || authErr.status === 429) {
        return error('⚠️ Supabase bloqueó la solicitud por seguridad. Espera unos segundos e intenta de nuevo.');
      }
      return error('⚠️ Error al crear usuario en Supabase: ' + authErr.message);
    }
  } catch (e) {
    return error('⚠️ Error de conexión con Supabase. Verifica que el proyecto esté activo.');
  }

  empresas.push({
    id: newEmpresaId, nombre, nit, responsable, ciudad, pais,
    tipo, telefono: tel, email: emailEmp, color,
    logoText: logo || nombre.slice(0, 2).toUpperCase(),
    creadaEn: new Date().toISOString().slice(0, 10), activa: true,
  });

  const newAdmin = {
    id: nextUserId++, email: adminEmail, pass: adminPass,
    nombre: adminNombre, role: 'admin',
    initials: adminNombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    empresaId: newEmpresaId, creadoPor: currentUser.nombre,
    creadoEn: new Date().toISOString().slice(0, 10),
  };
  usuarios.push(newAdmin);

  guardarUsuarios();

  // Inicializar datos vacíos (sin demo) para la nueva empresa
  try {
    localStorage.setItem('simpoe_v3_data_emp_' + newEmpresaId, JSON.stringify({
      equipos: [], mantenimientos: [], fallas: [],
      nextEqId: 1, nextMantId: 1, nextFallaId: 1
    }));
    localStorage.setItem('simpoe_activos_emp_' + newEmpresaId, JSON.stringify({
      activosEmpresariales: [], nextActivoId: 1
    }));
  } catch(e) { console.warn('No se pudo inicializar datos vacíos:', e); }

  closeModal('modal-nueva-empresa');
  renderEmpresas();
  updateBadges();

  ['ne-nombre','ne-nit','ne-responsable','ne-ciudad','ne-telefono','ne-email','ne-logo',
   'ne-admin-nombre','ne-admin-email','ne-admin-pass','ne-admin-pass2']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('ne-color').value = '#0ea5e9';

  toast('✅ Empresa y Admin Creados', `${nombre} · Admin: ${adminEmail}`, 'green');
}

function verEmpresa(id) {
  const emp = empresas.find(e=>e.id===id);
  if (!emp) return;
  const empUsers = usuarios.filter(u=>u.empresaId===id);
  const info = [
    ['Nombre', emp.nombre], ['NIT', emp.nit], ['Tipo', (SECTOR_CONFIG[emp.tipo]?.icono||'') + ' ' + (SECTOR_CONFIG[emp.tipo]?.nombre || emp.tipo || '—')], ['Responsable', emp.responsable||'—'],
    ['Ciudad', emp.ciudad||'—'], ['País', emp.pais||'—'],
    ['Teléfono', emp.telefono||'—'], ['Correo', emp.email||'—'],
    ['Creada el', fmtDate(emp.creadaEn)], ['Estado', emp.activa?'✅ Activa':'🔴 Inactiva'],
  ];
  const body = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div style="width:52px;height:52px;border-radius:13px;background:${emp.color};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;color:#fff">${emp.logoText||emp.nombre.slice(0,2).toUpperCase()}</div>
      <div><div style="font-size:1.1rem;font-weight:800">${emp.nombre}</div><div style="font-size:.78rem;color:var(--text3)">${emp.sector} · Código interno #${emp.id}</div></div>
    </div>
    ${info.map(([k,v])=>`<div class="kv-row"><span class="kv-key">${k}</span><span class="kv-val">${v}</span></div>`).join('')}
    <div class="divider"></div>
    <div style="font-size:.76rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Usuarios (${empUsers.length})</div>
    ${empUsers.length ? empUsers.map(u=>`
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(30,45,71,.3)">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:var(--text2)">${u.initials||u.nombre.slice(0,2).toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-size:.84rem;font-weight:600">${u.nombre}</div>
          <div style="font-size:.72rem;color:var(--text3)">${u.email}</div>
        </div>
        <span class="badge ${u.role==='admin'?'b-info':'b-ok'}" style="font-size:.68rem">${u.role==='admin'?'👑 Admin':u.role==='tecnico'?'🔧 Técnico':'⚠️ Operador'}</span>
      </div>`).join('') : '<div style="font-size:.81rem;color:var(--text3);text-align:center;padding:10px">Sin usuarios asignados aún.</div>'}`;

  // Use detalle modal temporarily
  document.getElementById('detalle-title').textContent = `🏢 ${emp.nombre}`;
  document.getElementById('detalle-body').innerHTML = body;
  document.getElementById('detalle-btn-mant').style.display='none';
  document.getElementById('detalle-btn-graf').style.display='none';
  document.getElementById('detalle-btn-qr').style.display='none';
  openModal('modal-detalle');
}

function toggleEmpresa(id) {
  const emp = empresas.find(e=>e.id===id);
  if (!emp) return;
  if (emp.activa && empresas.filter(e=>e.activa).length<=1) {
    toast('⚠️ Aviso','Debe existir al menos una empresa activa','yellow'); return;
  }
  emp.activa = !emp.activa;
  guardarUsuarios();
  renderEmpresas();
  toast(emp.activa?'✅ Empresa Activada':'🔴 Empresa Desactivada', emp.nombre, emp.activa?'green':'red');
}

function eliminarEmpresa(id) {
  if (!currentUser || currentUser.role !== 'superadmin') return;
  const emp = empresas.find(e=>e.id===id);
  if (!emp) return;

  // Protección: no eliminar la última empresa
  if (empresas.length <= 1) {
    toast('⚠️ Aviso', 'Debe existir al menos una empresa en el sistema', 'yellow');
    return;
  }

  // Contar usuarios y datos asociados
  const empUsuarios = usuarios.filter(u=>u.empresaId===id);
  const msg = `¿Eliminar la empresa "${emp.nombre}" permanentemente?\n\n` +
    `⚠️ Esto también eliminará:\n` +
    `• ${empUsuarios.length} usuario${empUsuarios.length!==1?'s':''} asociado${empUsuarios.length!==1?'s':''}\n` +
    `• Todos los datos operativos de esta empresa\n\n` +
    `Esta acción NO se puede deshacer.`;

  if (!confirm(msg)) return;

  // Eliminar empresa
  empresas = empresas.filter(e=>e.id!==id);
  // Eliminar usuarios de la empresa
  usuarios = usuarios.filter(u=>u.empresaId!==id);
  // Eliminar datos operativos (claves de localStorage)
  try {
    const dataKey = STORAGE_KEY + '_emp_' + id;
    localStorage.removeItem(dataKey);
    localStorage.removeItem('simpoe_activos_emp_' + id);
  } catch(e) {}

  nextEmpresaId = Math.max(...empresas.map(e=>e.id), 0) + 1;
  nextUserId    = Math.max(...usuarios.map(u=>u.id), 0) + 1;
  guardarUsuarios();
  renderEmpresas();
  updateBadges();
  toast('🗑 Empresa Eliminada', `${emp.nombre} y sus datos han sido eliminados`, 'red');
}

function abrirModalNuevoUsuario() {
  // Both admin and superadmin can create users
  if (!currentUser || !['admin','superadmin'].includes(currentUser.role)) {
    toast('🔒 Acceso restringido', 'Solo administradores pueden crear usuarios', 'red');
    return;
  }

  const creadorEl = document.getElementById('modal-usr-creador');
  if (creadorEl) creadorEl.textContent = currentUser.nombre;

  // Clear form
  ['nu-nombre','nu-email','nu-pass','nu-pass2'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  const errEl = document.getElementById('nu-error');
  if (errEl) errEl.style.display = 'none';

  // Populate empresa selector
  const empSel = document.getElementById('nu-empresa-id');
  const wrapEl = document.getElementById('nu-empresa-wrap');

  // Adjust role options based on who is creating
  const roleEl = document.getElementById('nu-role');
  if (roleEl) {
    if (currentUser.role === 'superadmin') {
      // Superadmin can create any role including admin for a company
      roleEl.innerHTML = `
        <option value="admin">👑 Administrador — Control completo dentro de la empresa</option>
        <option value="tecnico" selected>🔧 Técnico — Equipos, mantenimientos, consultas operativas</option>
        <option value="operador">⚠️ Operador — Solo reporte de fallas</option>`;
    } else {
      // Admin of a company can only create tecnico and operador (not another admin)
      roleEl.innerHTML = `
        <option value="tecnico" selected>🔧 Técnico — Equipos, mantenimientos, consultas operativas</option>
        <option value="operador">⚠️ Operador — Solo reporte de fallas</option>`;
    }
  }

  if (empSel) {
    if (currentUser.role === 'superadmin') {
      empSel.innerHTML = '<option value="">— Selecciona empresa —</option>' +
        empresas.filter(e=>e.activa).map(e=>`<option value="${e.id}">${e.nombre}</option>`).join('');
      if (wrapEl) wrapEl.style.display = 'block';
    } else if (empresaActual) {
      // Admin: locked to their own company, no need to show selector
      empSel.innerHTML = `<option value="${empresaActual.id}" selected>${empresaActual.nombre}</option>`;
      if (wrapEl) wrapEl.style.display = 'none';
    }
  }

  openModal('modal-nuevo-usuario');
}

function renderUsuarios() {
  if (!currentUser || !['admin','superadmin'].includes(currentUser.role)) {
    toast('🔒 Acceso restringido', 'Solo administradores', 'red');
    return;
  }

  // Filter users by company (admin sees own company, superadmin sees all)
  const usrVisible = currentUser.role === 'superadmin'
    ? usuarios.filter(u=>u.role!=='superadmin')
    : usuarios.filter(u=>u.empresaId===empresaActual?.id);

  const q       = (document.getElementById('usr-search')||{}).value||'';
  const admins  = usrVisible.filter(u=>u.role==='admin').length;
  const tecnicos= usrVisible.filter(u=>u.role==='tecnico').length;

  document.getElementById('usr-stats').innerHTML = `
    <div class="card"><div class="card-body" style="text-align:center;padding:16px">
      <div style="font-size:2rem;font-weight:800;font-family:var(--mono);color:var(--blue2)">${usrVisible.length}</div>
      <div class="cls-stat-sub">Total Usuarios</div>
    </div></div>
    <div class="card"><div class="card-body" style="text-align:center;padding:16px">
      <div style="font-size:2rem;font-weight:800;font-family:var(--mono);color:var(--purple2)">${admins}</div>
      <div class="cls-stat-sub">Administradores</div>
    </div></div>
    <div class="card"><div class="card-body" style="text-align:center;padding:16px">
      <div style="font-size:2rem;font-weight:800;font-family:var(--mono);color:var(--green2)">${tecnicos}</div>
      <div class="cls-stat-sub">Técnicos</div>
    </div></div>`;

  const filtrado = usrVisible.filter(u =>
    u.nombre.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase())
  );

  document.getElementById('usr-tbody').innerHTML = filtrado.length
    ? filtrado.map(u => {
        const empNombre = u.empresaId ? (empresas.find(e=>e.id===u.empresaId)?.nombre||'—') : '🌐 Global';
        const rolBadge = {
          superadmin: '<span class="badge"><span class="badge-dot"></span>🌐 Super Admin</span>',
          admin:      '<span class="badge"><span class="badge-dot"></span>👑 Admin</span>',
          tecnico:    '<span class="badge b-ok"><span class="badge-dot"></span>🔧 Técnico</span>',
          reportante: '<span class="badge b-warn"><span class="badge-dot"></span>⚠️ Operador</span>',
        }[u.role] || '<span class="badge b-info">?</span>';
        return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:50%;background:${u.role==='admin'||u.role==='superadmin'?'linear-gradient(135deg,#0ea5e9,#0ea5e9)':'linear-gradient(135deg,#22c55e,#06b6d4)'};display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#fff;flex-shrink:0">
              ${u.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:700;font-size:.88rem">${u.nombre}</div>
              <div style="font-size:.72rem;color:var(--text3)">ID #${u.id}</div>
            </div>
          </div>
        </td>
        <td style="font-size:.82rem;color:var(--text2);font-family:var(--mono)">${u.email}</td>
        <td>${rolBadge}</td>
        <td style="font-size:.8rem;color:var(--text2)">${empNombre}</td>
        <td style="font-size:.82rem;color:var(--text2)">${u.creadoPor||'—'}</td>
        <td style="font-family:var(--mono);font-size:.79rem;color:var(--text3)">${fmtDate(u.creadoEn)||'—'}</td>
        <td><span class="badge b-ok"><span class="badge-dot"></span>Activo</span></td>
        <td>
          <button class="btn btn-ghost btn-xs" onclick="verUsuario(${u.id})" title="Ver detalle">🔍</button>
          ${currentUser?.role==='superadmin' && u.id!==currentUser.id ? `<button class="btn btn-warn btn-xs" onclick="resetPassword(${u.id})" title="Restablecer contraseña">🔑</button>` : ''}
          ${u.id !== currentUser.id
            ? `<button class="btn btn-danger btn-xs" onclick="eliminarUsuario(${u.id})" title="Eliminar">✕</button>`
            : '<span style="font-size:.72rem;color:var(--text3);padding:0 6px">Tú</span>'}
        </td>
      </tr>`;
      }).join('')
    : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">No se encontraron usuarios</td></tr>`;
}

async function crearUsuario() {
  if (!currentUser || !['admin','superadmin'].includes(currentUser.role)) return;

  const nombre    = document.getElementById('nu-nombre').value.trim();
  const email     = document.getElementById('nu-email').value.trim().toLowerCase();
  const pass      = document.getElementById('nu-pass').value;
  const pass2     = document.getElementById('nu-pass2').value;
  const role      = document.getElementById('nu-role').value;
  const empSelEl  = document.getElementById('nu-empresa-id');
  const empresaId = empSelEl ? (+empSelEl.value || empresaActual?.id || null) : (empresaActual?.id || null);
  const errEl     = document.getElementById('nu-error');

  const mostrarError = msg => { errEl.textContent=msg; errEl.style.display='block'; };
  errEl.style.display = 'none';

  if (!nombre)                       return mostrarError('⚠️ Ingresa el nombre completo.');
  if (!email || !email.includes('@')) return mostrarError('⚠️ Ingresa un correo válido.');
  if (pass.length < 4)               return mostrarError('⚠️ La contraseña debe tener al menos 4 caracteres.');
  if (pass !== pass2)                return mostrarError('⚠️ Las contraseñas no coinciden.');
  if (usuarios.find(u=>u.email===email)) return mostrarError('⚠️ Ya existe un usuario con ese correo.');
  if (!empresaId && role !== 'superadmin') return mostrarError('⚠️ Selecciona la empresa del usuario.');

  const btn = document.getElementById('modal-nuevo-usuario')?.querySelector('.btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creando...'; }

  try {
    // Intentar crear en Supabase Auth (falla por rate limit? no importa)
    try {
      if (window.sb) {
        const { error: authError } = await sb.auth.signUp({
          email, password: pass,
          options: { data: { nombre, role, empresa_id: empresaId } }
        });
        if (authError) console.warn('SIMPOE: No se pudo crear en Supabase Auth:', authError.message);
      }
    } catch (sbErr) {
      console.warn('SIMPOE: Supabase Auth no disponible, creando solo local:', sbErr.message);
    }

    // Crear usuario en localStorage (siempre funciona)
    const newUser = {
      id: nextUserId++, email, nombre, role,
      empresaId: empresaId || null, pass,
      creadoPor: currentUser.nombre,
      creadoEn: new Date().toISOString().slice(0, 10),
    };
    usuarios.push(newUser);
    guardarUsuarios();
    recalcCounters();
    updateBadges();

    ['nu-nombre','nu-email','nu-pass','nu-pass2'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('nu-role').value = 'tecnico';
    errEl.style.display = 'none';
    closeModal('modal-nuevo-usuario');
    renderUsuarios();
    const rl = {admin:'👑 Admin', tecnico:'🔧 Técnico', operador:'⚠️ Operador'};
    const empNombre = empresaId ? (empresas.find(e => e.id === empresaId)?.nombre || '—') : 'Global';
    toast('✅ Usuario Creado', `${nombre} · ${rl[role]||role} · ${empNombre}`, 'green');
  } catch (e) {
    mostrarError('⚠️ ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✔ Crear Usuario'; }
  }
}

function verUsuario(id) {
  const u = usuarios.find(x=>x.id===id);
  if (!u) return;

  document.getElementById('modal-vu-titulo').textContent = `👤 ${u.nombre}`;
  document.getElementById('modal-vu-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
      <div style="width:56px;height:56px;border-radius:50%;background:${u.role==='admin'?'linear-gradient(135deg,#0ea5e9,#0ea5e9)':'linear-gradient(135deg,#22c55e,#06b6d4)'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:#fff;flex-shrink:0">
        ${u.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
      </div>
      <div>
        <div style="font-size:1.1rem;font-weight:800">${u.nombre}</div>
        <div style="font-size:.8rem;color:var(--text3);margin-top:2px">${u.email}</div>
        <div style="margin-top:6px">
          ${u.role==='admin'
            ? '<span class="badge"><span class="badge-dot"></span>👑 Administrador</span>'
            : '<span class="badge b-ok"><span class="badge-dot"></span>🔧 Técnico</span>'}
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="kv-row"><span class="kv-key">ID de usuario</span><span class="kv-val" style="font-family:var(--mono)">#${u.id}</span></div>
    <div class="kv-row"><span class="kv-key">Correo electrónico</span><span class="kv-val" style="color:var(--blue2)">${u.email}</span></div>
    <div class="kv-row"><span class="kv-key">Rol asignado</span><span class="kv-val">${u.role==='admin'?'👑 Administrador':'🔧 Técnico'}</span></div>
    <div class="kv-row"><span class="kv-key">Creado por</span><span class="kv-val">${u.creadoPor||'Sistema'}</span></div>
    <div class="kv-row"><span class="kv-key">Fecha de creación</span><span class="kv-val" style="font-family:var(--mono)">${fmtDate(u.creadoEn)||'—'}</span></div>
    <div class="kv-row"><span class="kv-key">Estado</span><span class="badge b-ok"><span class="badge-dot"></span>Activo</span></div>
    ${currentUser?.role==='superadmin' ? `
    <div class="kv-row">
      <span class="kv-key">🔑 Contraseña</span>
      <span class="kv-val" style="color:var(--text3);font-size:.8rem">Gestionada por Supabase Auth — usa "Restablecer Contraseña" para enviar email de recuperación</span>
    </div>` : ''}
    <div class="divider"></div>
    <div style="background:rgba(14,165,233,.07);border:1px solid rgba(14,165,233,.15);border-radius:var(--r);padding:10px 13px;font-size:.8rem;color:var(--text2)">
      🔐 <strong>Permisos:</strong>
      ${u.role==='admin'
        ? 'Acceso completo — Dashboard, Equipos, Cálculo, Gráficas, Costos, Productividad, IA, Alertas, Historial, Mantenimiento, Reporte y <strong style="color:var(--purple2)">Gestión de Usuarios</strong>.'
        : 'Acceso operativo — Dashboard, Equipos, Cálculo, Gráficas, Costos, Productividad, IA, Alertas, Historial, Mantenimiento y Reporte. <span style="color:var(--red2)">Sin acceso a Gestión de Usuarios.</span>'}
    </div>`;

  document.getElementById('modal-vu-eliminar').onclick = () => {
    closeModal('modal-ver-usuario');
    eliminarUsuario(id);
  };
  document.getElementById('modal-vu-eliminar').style.display = (u.id === currentUser?.id) ? 'none' : 'inline-flex';

  // Superadmin: show password reset button
  const resetBtn = document.getElementById('modal-vu-reset');
  if (resetBtn) {
    if (currentUser?.role === 'superadmin' && u.id !== currentUser.id) {
      resetBtn.style.display = 'inline-flex';
      resetBtn.onclick = () => resetPassword(u.id);
    } else {
      resetBtn.style.display = 'none';
    }
  }

  openModal('modal-ver-usuario');
}

// ── Password reset (envía email de recuperación) ──
async function resetPassword(id) {
  if (!currentUser || currentUser.role !== 'superadmin') return;
  const u = usuarios.find(x => x.id === id);
  if (!u) return;

  if (!confirm(`Enviar correo de restablecimiento de contraseña a "${u.nombre}" (${u.email})?`)) return;

  try {
    const { error } = await sb.auth.resetPasswordForEmail(u.email);
    if (error) throw error;
    toast('📧 Email Enviado', `Instrucciones enviadas a ${u.email}`, 'green');
    closeModal('modal-ver-usuario');
  } catch (e) {
    toast('⚠️ Error', e.message, 'red');
  }
}

function eliminarUsuario(id) {
  if (!currentUser || !['admin','superadmin'].includes(currentUser.role)) return;
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  if (u.id === currentUser.id) { toast('⚠️ Aviso', 'No puedes eliminar tu propia cuenta', 'yellow'); return; }
  const adminsRestantes = usuarios.filter(x => x.role === 'admin' && x.id !== id).length;
  if (u.role === 'admin' && adminsRestantes === 0) {
    toast('⚠️ Aviso', 'Debe existir al menos un administrador en el sistema', 'yellow');
    return;
  }
  if (!confirm(`¿Eliminar al usuario "${u.nombre}"?\nEsta acción no se puede deshacer.`)) return;

  usuarios = usuarios.filter(x => x.id !== id);
  guardarUsuarios();
  recalcCounters();
  renderUsuarios();
  updateBadges();
  toast('🗑️ Usuario Eliminado', u.nombre, 'red');
}

function recalcCounters() {
  updateBadges();
}

function syncNow() {
  if (!currentUser) { toast('⚠️ Aviso', 'Inicia sesión para sincronizar', 'yellow'); return; }
  if (typeof sb === 'undefined') { toast('⚠️ Sin conexión', 'Supabase no está disponible', 'yellow'); return; }
  if (typeof window.syncToSupabase === 'function') window.syncToSupabase();
  if (typeof window.syncActivosToSupabase === 'function') window.syncActivosToSupabase();
  toast('☁️ Sincronizando', 'Subiendo datos a la nube...', 'blue');
}

// ══════════════════════════════════════════════
//  CENTRO DE CONTROL OPERACIONAL — MINIMALISTA
// ══════════════════════════════════════════════
function toggleDashDetalle(btn) {
  const det   = document.getElementById('dash-detalle');
  const label = document.getElementById('dash-detalle-label');
  const arrow = document.getElementById('dash-arrow');
  const open  = det.style.display === 'none';
  det.style.display = open ? 'block' : 'none';
  label.textContent = open ? 'Ocultar detalles' : 'Ver alertas y mantenimientos';
  arrow.textContent = open ? '▴' : '▾';
}

function renderSuperAdminDashboard() {
  const dashTitle = document.getElementById('dash-title');
  if (dashTitle) dashTitle.innerHTML = `<i data-lucide="shield" style="width:22px;height:22px;vertical-align:middle;"></i> Panel de Control — Super Admin`;

  const totalEmpresas = empresas.length;
  const activas = empresas.filter(e => e.activa).length;
  const admins = usuarios.filter(u => u.role === 'admin').length;
  const tecnicos = usuarios.filter(u => u.role === 'tecnico').length;
  const operadores = usuarios.filter(u => u.role === 'operador').length;
  const totalUsuarios = admins + tecnicos + operadores;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-icon">🏢</div>
      <div class="stat-value">${totalEmpresas}</div>
      <div class="stat-label">Empresas Registradas</div>
      <div class="stat-sub">${activas} activas</div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon">👥</div>
      <div class="stat-value">${totalUsuarios}</div>
      <div class="stat-label">Usuarios Totales</div>
      <div class="stat-sub">Sin contar Super Admin</div>
    </div>
    <div class="stat-card yellow">
      <div class="stat-icon">✅</div>
      <div class="stat-value">${activas}</div>
      <div class="stat-label">Empresas Activas</div>
      <div class="stat-sub">Con acceso al sistema</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-icon">🔒</div>
      <div class="stat-value">${totalEmpresas - activas}</div>
      <div class="stat-label">Desactivadas</div>
      <div class="stat-sub">Sin acceso al sistema</div>
    </div>`;

  document.getElementById('dash-mensaje-principal').innerHTML = `
    <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:8px 14px;display:flex;gap:8px;align-items:center">
      <span style="font-size:1.1rem">🛡️</span>
      <div style="font-size:.78rem;color:var(--text-gray);line-height:1.3">Bienvenido, <strong style="color:var(--deep-blue)">${currentUser?.nombre || 'Super Admin'}</strong>. Administra empresas y usuarios del sistema.</div>
    </div>`;

  const alertasEl = document.getElementById('dash-alerts');
  if (alertasEl) {
    alertasEl.innerHTML = `
      <div style="padding:12px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600;font-size:.84rem">🏢 Empresas</span>
          <span style="font-weight:800;font-family:var(--mono);color:var(--blue2)">${totalEmpresas}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600;font-size:.84rem">👑 Administradores</span>
          <span style="font-weight:800;font-family:var(--mono);color:var(--purple2)">${admins}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600;font-size:.84rem">🔧 Técnicos</span>
          <span style="font-weight:800;font-family:var(--mono);color:var(--yellow2)">${tecnicos}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600;font-size:.84rem">⚠️ Operadores</span>
          <span style="font-weight:800;font-family:var(--mono);color:var(--orange2)">${operadores}</span>
        </div>
      </div>`;
  }

  const proximosEl = document.getElementById('dash-proximos');
  if (proximosEl) {
    proximosEl.innerHTML = empresas.length
      ? empresas.map(emp => {
          const empUsers = usuarios.filter(u => u.empresaId === emp.id);
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="min-width:0;flex:1">
                <div style="font-weight:700;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${emp.nombre}</div>
                <div style="font-size:.73rem;color:var(--text3)">${emp.ciudad || '—'} · ${emp.responsable || '—'}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;margin-left:10px">
                <div style="font-weight:800;font-family:var(--mono);color:var(--blue2);font-size:.92rem">${empUsers.length}</div>
                <div style="font-size:.68rem;color:var(--text3)">usuarios</div>
              </div>
            </div>`;
        }).join('')
      : `<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:.83rem">Sin empresas registradas aún</div>`;
  }

  const ac = document.getElementById('dash-alert-count');
  if (ac) { ac.style.display = 'none'; ac.textContent = '0'; }
}

function renderDashboard() {
  if (currentUser?.role === 'superadmin') {
    renderSuperAdminDashboard();
    return;
  }
  const all  = equipos.map(e=>({eq:e, c:calcEquipo(e)}));
  const ok   = all.filter(x=>x.c.estado==='ok').length;
  const warn = all.filter(x=>x.c.estado==='warn').length;
  const crit = all.filter(x=>x.c.estado==='crit').length;
  const avgS = all.length ? Math.round(all.reduce((a,x)=>a+x.c.saludPct,0)/all.length) : 0;

  // ── 4 Indicadores ─────────────────────────────────────────
  // Stats adaptados por sector
  const sectorStats = getDashboardStats(all);
  document.getElementById('dash-stats').innerHTML = sectorStats.map(s=>`
    <div class="stat-card ${s.color}">
      <div class="stat-icon">${s.i}</div>
      <div class="stat-value">${s.v}</div>
      <div class="stat-label">${s.l}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>`).join('');

  // Título dinámico según sector
  const tipo = getTipoEmpresa();
  const cfg  = SECTOR_CONFIG[tipo];
  const dashTitle = document.getElementById('dash-title');
  if (dashTitle && cfg) dashTitle.innerHTML = `<i data-lucide="sliders" style="width:22px;height:22px;vertical-align:middle;"></i> Centro de Control — ${cfg.nombre}`;

  // ── UN solo mensaje — el más importante ───────────────────
  const msgs   = generarMensajesSistema();
  const top    = msgs[0]; // solo el primero
  const colores = { crit:'rgba(239,68,68,.08)', warn:'rgba(245,158,11,.08)', ok:'rgba(34,197,94,.07)' };
  const bordes  = { crit:'var(--red)', warn:'var(--yellow)', ok:'var(--green)' };

  document.getElementById('dash-mensaje-principal').innerHTML = top
    ? `<div style="background:${colores[top.nivel]};border:1px solid ${bordes[top.nivel]};border-radius:12px;padding:8px 14px;display:flex;gap:8px;align-items:center">
        <span style="font-size:1.1rem;flex-shrink:0">${top.icono}</span>
        <div style="flex:1;font-size:.78rem;color:var(--text-gray);line-height:1.3">${top.texto}</div>
        ${msgs.length>1 ? `<div style="font-size:.68rem;color:var(--text-gray);flex-shrink:0">+${msgs.length-1}</div>` : ''}
      </div>`
    : `<div style="background:#E0F2F1;border:1px solid #B2DFDB;border-radius:12px;padding:8px 14px;display:flex;gap:8px;align-items:center">
        <span style="font-size:1.1rem">🟢</span>
        <div style="font-size:.78rem;color:var(--text-gray)">Registra equipos para ver el diagnóstico automático del sistema.</div>
      </div>`;

  // ── Alertas (en el panel expandible) ─────────────────────
  const alertas = all.filter(x=>x.c.estado!=='ok').sort((a,b)=>a.c.saludPct-b.c.saludPct);
  const ac = document.getElementById('dash-alert-count');
  if(ac){ ac.style.display=alertas.length>0?'inline-flex':'none'; ac.textContent=alertas.length; }

  const alertsEl = document.getElementById('dash-alerts');
  if(alertsEl) alertsEl.innerHTML = alertas.length
    ? alertas.slice(0,5).map(({eq,c})=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="flex-shrink:0">${c.estado==='crit'?'🔴':'⚠️'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eq.nombre}</div>
            <div style="font-size:.73rem;color:var(--text3)">${c.diasMantenimiento===0?'⚡ Urgente':c.diasMantenimiento+'d para mant.'} · ${c.saludPct}% salud</div>
          </div>
          <button class="btn btn-warn btn-xs" onclick="irAMant(${eq.id})">🔧</button>
        </div>`).join('')
    : `<div style="padding:16px 0;text-align:center;color:var(--green2);font-size:.83rem">✅ Sin alertas activas</div>`;

  // ── Próximos mantenimientos (en el panel expandible) ──────
  const proximosEl = document.getElementById('dash-proximos');
  if(proximosEl) proximosEl.innerHTML = all.length
    ? [...all].sort((a,b)=>a.c.diasMantenimiento-b.c.diasMantenimiento).slice(0,5)
        .map(({eq,c})=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="min-width:0;flex:1">
              <div style="font-weight:700;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eq.nombre}</div>
              <div style="font-size:.73rem;color:var(--text3)">${eq.tipo}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-left:10px">
              <div style="font-weight:800;font-family:var(--mono);color:${dC(c.diasMantenimiento)};font-size:.92rem">${c.diasMantenimiento}d</div>
              ${badge(c.estado)}
            </div>
          </div>`).join('')
    : `<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:.83rem">Sin equipos aún</div>`;
}

// ══════════════════════════════════════════════
//  EQUIPOS
// ══════════════════════════════════════════════
function setEqTab(tab,el) {
  eqTabFilter=tab;
  document.querySelectorAll('#eq-tab-all,#eq-tab-ok,#eq-tab-warn,#eq-tab-crit').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderEquipos();
}
function renderEquipos() {
  const q=(document.getElementById('eq-search')||{}).value||'';
  // If nothing typed and filter is 'all', show empty state
  if(!q && eqTabFilter==='all') {
    document.getElementById('eq-cards').innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p>Escribe el nombre del equipo que deseas buscar</p></div>`;
    return;
  }
  let data=equipos.filter(e=>e.nombre.toLowerCase().includes(q.toLowerCase())||e.tipo.toLowerCase().includes(q.toLowerCase()));
  if(eqTabFilter!=='all') data=data.filter(e=>calcEquipo(e).estado===eqTabFilter);
  document.getElementById('eq-cards').innerHTML=data.length?data.map(eq=>{
    const c=calcEquipo(eq);
    return `<div class="eq-card ${c.estado}" onclick="abrirDetalle(${eq.id})">
      <div class="eq-card-top">
        <div><div class="eq-card-name">${eq.nombre}</div><div class="eq-card-type">${eq.tipo}${eq.ubicacion?' · '+eq.ubicacion:''}</div></div>
        ${badge(c.estado)}
      </div>
      ${pb(c.saludPct)}
      <div class="eq-card-stats">
        <div class="eq-cs"><div class="eq-cs-val" style="color:${sC2(c.saludPct)}">${c.saludPct}%</div><div class="eq-cs-lbl">Salud</div></div>
        <div class="eq-cs"><div class="eq-cs-val" style="color:${dC(c.diasMantenimiento)}">${c.diasMantenimiento}d</div><div class="eq-cs-lbl">Días p/Mant</div></div>
        <div class="eq-cs"><div class="eq-cs-val" style="color:var(--blue2)">${c.vidaRestante}h</div><div class="eq-cs-lbl">Vida Rest.</div></div>
        <div class="eq-cs"><div class="eq-cs-val" style="color:var(--text2)">${eq.factor}x</div><div class="eq-cs-lbl">Factor</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
        <div style="font-size:.73rem;color:var(--text3)">Hrs Ajust: <span style="font-family:var(--mono);color:var(--text2)">${c.horasAjustadas}h</span></div>
        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();confirmarEliminar(${eq.id})">✕</button>
      </div>
    </div>`;
  }).join(''):`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">⚙️</div><p>No se encontraron equipos con ese criterio</p></div>`;
}

// ══════════════════════════════════════════════
//  CÁLCULO
// ══════════════════════════════════════════════
function renderCalculo() {
  // Populate selector
  const sel = document.getElementById('calc-equipo-sel');
  if(sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Selecciona un equipo —</option>' +
      equipos.map(e=>`<option value="${e.id}">${e.nombre} (${e.tipo})</option>`).join('');
    if(cur) sel.value = cur;
  }
  // Populate quick-mant-equipo if present
  ['quick-mant-equipo'].forEach(id=>{
    const s=document.getElementById(id);
    if(s){ s.innerHTML=equipos.map(e=>`<option value="${e.id}">${e.nombre}</option>`).join(''); }
  });
  // Show empty or result
  calcSeleccionar();
}

function calcSeleccionar() {
  const id  = +document.getElementById('calc-equipo-sel').value;
  const res = document.getElementById('calc-resultado');
  const emp = document.getElementById('calc-empty');

  if (!id) {
    if(res) res.style.display = 'none';
    if(emp) emp.style.display = 'block';
    return;
  }

  if(emp) emp.style.display = 'none';
  if(res) res.style.display = 'block';

  const eq = equipos.find(e=>e.id===id);
  if(!eq) return;
  const c = calcEquipo(eq);

  // ── Banner estado ───────────────────────────────────────
  const bannerColor = c.estado==='ok'
    ? {bg:'rgba(58,170,92,.08)',border:'var(--green)',icon:'✅',msg:`Operación normal — ${c.diasMantenimiento} días para el próximo mantenimiento.`}
    : c.estado==='warn'
    ? {bg:'rgba(212,150,12,.08)',border:'var(--yellow)',icon:'⚠️',msg:`Atención requerida — Programar mantenimiento en los próximos ${c.diasMantenimiento} días.`}
    : {bg:'rgba(220,53,53,.08)',border:'var(--red)',icon:'🔴',msg:`Intervención urgente — El equipo ha alcanzado el ${c.usoPct}% de su ciclo. Detener y realizar mantenimiento.`};

  const banner = `<div style="background:${bannerColor.bg};border:1px solid ${bannerColor.border};border-radius:var(--r);padding:11px 16px;font-size:.83rem;color:var(--text2);margin-bottom:16px;display:flex;gap:10px;align-items:center">
    <span style="font-size:1.1rem;flex-shrink:0">${bannerColor.icon}</span>
    <span>${bannerColor.msg}</span>
  </div>`;

  // ── Card principal ──────────────────────────────────────
  document.getElementById('calc-card-detalle').innerHTML = `
    <div class="card-head">
      <div>
        <div style="font-weight:800;font-size:1rem">${eq.nombre}</div>
        <div style="font-size:.75rem;color:var(--text3);margin-top:2px">${eq.tipo}${eq.ubicacion?' · '+eq.ubicacion:''}${eq.fabricante?' · '+eq.fabricante:''}</div>
      </div>
      ${badge(c.estado)}
    </div>
    <div class="card-body">
      ${banner}
      <div class="rg-2" style="align-items:start">

        <!-- Datos del cálculo -->
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            ['⏱ Horas Acumuladas',   eq.horasAcum+'h',          'var(--text)'],
            ['⚡ Factor de Uso',      eq.factor+'×',              eq.factor>=1.5?'var(--red2)':eq.factor>1?'var(--yellow2)':'var(--green2)'],
            ['🔧 Hrs Ajustadas',      c.horasAjustadas+'h',       'var(--yellow2)'],
            ['📅 Hrs Recomendadas',   eq.horasRec+'h',            'var(--text2)'],
            ['💚 Vida Útil Restante', c.vidaRestante+'h',         'var(--green2)'],
            ['📆 Días p/Mantenimiento', c.diasMantenimiento+'d',  dC(c.diasMantenimiento)],
            ['🔄 Ciclo Usado',         c.usoPct+'%',              sC2(100-c.usoPct)],
          ].map(([k,v,col])=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)">
              <span style="font-size:.79rem;color:var(--text3)">${k}</span>
              <span style="font-weight:800;font-family:var(--mono);font-size:.88rem;color:${col}">${v}</span>
            </div>`).join('')}
        </div>

        <!-- Ring de salud -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:10px">
          <div style="position:relative;width:150px;height:150px">
            <svg width="150" height="150" viewBox="0 0 150 150" style="transform:rotate(-90deg)">
              <circle cx="75" cy="75" r="60" fill="none" stroke="var(--border)" stroke-width="14"/>
              <circle cx="75" cy="75" r="60" fill="none" stroke="${sC(c.saludPct)}" stroke-width="14"
                stroke-dasharray="${((c.saludPct/100)*2*Math.PI*60).toFixed(1)} ${(2*Math.PI*60).toFixed(1)}"
                stroke-linecap="round" style="filter:drop-shadow(0 0 10px ${sC(c.saludPct)});transition:all .8s ease"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <span style="font-size:2.2rem;font-weight:900;font-family:var(--mono);color:${sC2(c.saludPct)};line-height:1">${c.saludPct}%</span>
              <span style="font-size:.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Índice de Salud</span>
            </div>
          </div>
          <div style="text-align:center">
            ${badge(c.estado)}
            <div style="font-size:.75rem;color:var(--text3);margin-top:6px">
              ${c.estado==='ok'?'🟢 Condición Óptima':c.estado==='warn'?'🟡 Requiere Atención':'🔴 Estado Crítico'}
            </div>
          </div>
          <div style="width:100%">
            <div style="font-size:.72rem;color:var(--text3);margin-bottom:5px;text-align:center">Desgaste acumulado</div>
            ${pb(c.usoPct)}
            <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text3);margin-top:4px">
              <span>0%</span><span style="color:${sC2(c.usoPct)};font-weight:700">${c.usoPct}%</span><span>100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // ── Fórmulas explicativas ─────────────────────────────
  const formulasEl = document.getElementById('calc-formulas');
  if(formulasEl) formulasEl.innerHTML = [
    {label:'Horas Ajustadas',    formula:`${eq.horasAcum}h × ${eq.factor} = <strong>${c.horasAjustadas}h</strong>`,
     hint:'Desgaste real considerando la intensidad de uso'},
    {label:'Vida Útil Restante', formula:`${eq.horasRec}h − ${c.horasAjustadas}h = <strong>${c.vidaRestante}h</strong>`,
     hint:'Horas disponibles antes del próximo mantenimiento'},
    {label:'% Índice de Salud',  formula:`(${c.vidaRestante} ÷ ${eq.horasRec}) × 100 = <strong>${c.saludPct}%</strong>`,
     hint:'Porcentaje de vida útil restante del ciclo'},
    {label:'Días para Mant.',    formula:`${c.vidaRestante}h ÷ ${eq.horasDia}h/día = <strong>${c.diasMantenimiento}d</strong>`,
     hint:'Días estimados antes de requerir intervención'},
  ].map(f=>`
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:10px 13px">
      <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;color:var(--blue2);margin-bottom:5px;font-weight:700">${f.label}</div>
      <div style="font-family:var(--mono);font-size:.83rem;color:var(--text);margin-bottom:4px">${f.formula}</div>
      <div style="font-size:.72rem;color:var(--text3)">${f.hint}</div>
    </div>`).join('');

  updateSimPreview();
}

function updateSimPreview() {
  const id = +document.getElementById('calc-equipo-sel').value;
  const dias = +document.getElementById('sim-dias').value||0;
  const eq = equipos.find(e=>e.id===id);
  const p = document.getElementById('sim-preview');
  if(!p) return;
  if(!eq||!dias){p.innerHTML='<span style="color:var(--text3)">Ingresa los días para ver el impacto</span>';return;}
  const eqSim={...eq,horasAcum:eq.horasAcum+dias*eq.horasDia};
  const c1=calcEquipo(eq),c2=calcEquipo(eqSim);
  p.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
    <div><div style="font-weight:800;color:${sC2(c2.saludPct)};font-family:var(--mono)">${c1.saludPct}% → ${c2.saludPct}%</div><div style="font-size:.7rem;color:var(--text3)">Salud</div></div>
    <div><div style="font-weight:800;color:${dC(c2.diasMantenimiento)};font-family:var(--mono)">${c1.diasMantenimiento}d → ${c2.diasMantenimiento}d</div><div style="font-size:.7rem;color:var(--text3)">Días p/Mant.</div></div>
    <div><div style="font-weight:800;color:var(--blue2);font-family:var(--mono)">+${dias*eq.horasDia}h</div><div style="font-size:.7rem;color:var(--text3)">Horas extra</div></div>
  </div>`;
}

function simularUso() {
  const id=+document.getElementById('calc-equipo-sel').value;
  const dias=+document.getElementById('sim-dias').value||0;
  const eq=equipos.find(e=>e.id===id);
  if(!eq||!dias){toast('⚠️ Error','Selecciona equipo y días','yellow');return;}
  const extra=dias*eq.horasDia;
  eq.horasAcum+=extra;
  guardarDatos();
  calcSeleccionar(); renderDashboard(); updateBadges();
  toast('▶ Simulación Aplicada',`${eq.nombre} +${extra}h acumuladas`,'blue');
}

function registrarMantenimientoRapido() {
  const id=+document.getElementById('calc-equipo-sel').value;
  const tipo=document.getElementById('quick-mant-tipo').value;
  const desc=document.getElementById('quick-mant-desc').value.trim();
  const eq=equipos.find(e=>e.id===id);
  if(!eq){toast('⚠️ Error','Selecciona un equipo primero','yellow');return;}
  if(!desc){toast('⚠️ Error','Escribe una descripción','yellow');return;}
  mantenimientos.push({id:nextMantId++,equipoId:eq.id,equipoNombre:eq.nombre,fecha:new Date().toISOString().slice(0,10),tipo,desc,tecnico:currentUser?currentUser.nombre:'—',costo:0});
  if (tipo !== 'Correctivo') eq.horasAcum = 0;
  guardarDatos(); calcSeleccionar(); updateBadges();
  document.getElementById('quick-mant-desc').value='';
  toast('✔ Mantenimiento Rápido',`${eq.nombre} — ciclo reiniciado`,'green');
}

// ══════════════════════════════════════════════
//  GRÁFICAS
// ══════════════════════════════════════════════



// Genera datos demo realistas según el tipo de empresa activa



// ══════════════════════════════════════════════
//  IA TRANSPORTE — Motor de Mantenimiento IA
// ══════════════════════════════════════════════
const FACTOR_COND_OP = {
  'Normal':1.0,'Alta intensidad':0.75,'Montañosa':0.70,'Urbana congestionada':0.80,'Mixta':0.90
};
const MANT_INTERVALOS_BASE = [
  {id:'aceite',      nombre:'Cambio de aceite y filtro',        kmBase:10000,prioridad:'alta', icono:'🛢️'},
  {id:'filtro-aire', nombre:'Cambio de filtro de aire',         kmBase:15000,prioridad:'media',icono:'💨'},
  {id:'filtro-comb', nombre:'Cambio de filtro combustible',     kmBase:20000,prioridad:'media',icono:'⛽'},
  {id:'frenos',      nombre:'Revisión y ajuste de frenos',      kmBase:25000,prioridad:'alta', icono:'🛑'},
  {id:'llantas',     nombre:'Rotación y balanceo de llantas',   kmBase:15000,prioridad:'media',icono:'⭕'},
  {id:'alineacion',  nombre:'Alineación de dirección',          kmBase:20000,prioridad:'media',icono:'🔄'},
  {id:'suspension',  nombre:'Revisión de suspensión',           kmBase:30000,prioridad:'alta', icono:'🔩'},
  {id:'transmision', nombre:'Revisión de transmisión',          kmBase:40000,prioridad:'alta', icono:'⚙️'},
  {id:'refrigerante',nombre:'Cambio de refrigerante',           kmBase:50000,prioridad:'media',icono:'🌡️'},
  {id:'correa',      nombre:'Inspección correa de tiempo',      kmBase:60000,prioridad:'alta', icono:'🔗'},
];

// ══════════════════════════════════════════════
//  IA CONSTRUCCIÓN — Motor de Mantenimiento
// ══════════════════════════════════════════════

const FACTOR_NIVEL_TRABAJO = {
  'Normal — Terreno plano':          1.0,
  'Alta — Terreno difícil':          0.75,
  'Muy alta — Demolición/Roca':      0.60,
  'Extrema — Condiciones adversas':  0.50,
};
const FACTOR_TURNO_CONST = {
  '1 turno (8h/día)':  1.0,
  '2 turnos (16h/día)': 0.80,
  '3 turnos (24h/día)': 0.65,
};


// ══════════════════════════════════════════════
//  IA INDUSTRIAL — Motor de Mantenimiento
// ══════════════════════════════════════════════

// Factores de ajuste por condición de trabajo
const FACTOR_COND_TRABAJO = {
  'Normal':1.0, 'Polvo / Partículas':0.75, 'Alta temperatura ambiente':0.70,
  'Humedad / Vapor':0.72, 'Vibraciones externas':0.68, 'Corrosivo':0.65, 'Mixta':0.80,
};
// Factor por criticidad
const FACTOR_CRITICIDAD = {
  'Alta — Producción crítica':0.75, 'Media — Afecta parcialmente':0.90, 'Baja — No crítico':1.0
};


// prodCalc — productividad por horas operativas


function renderIA() {
  const iaSel = document.getElementById('ia-equipo-sel');
  if (iaSel) {
    const cur = iaSel.value;
    iaSel.innerHTML = '<option value="">— Selecciona un equipo —</option>' +
      equipos.map(e=>`<option value="${e.id}">${e.nombre} (${e.tipo})</option>`).join('');
    if (cur) iaSel.value = cur;
  }

  const iaBody = document.getElementById('ia-body');
  if (!iaBody) return;

  const eqId = iaSel ? +iaSel.value : 0;

  // ── Estado vacío ─────────────────────────────────────────
  if (!eqId) {
    iaBody.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;color:var(--text3);text-align:center">
        <div style="font-size:3rem;margin-bottom:14px;opacity:.35">🧠</div>
        <div style="font-size:.95rem;font-weight:700;color:var(--text2);margin-bottom:8px">Selecciona un equipo para analizar</div>
        <div style="font-size:.81rem;line-height:1.6;max-width:360px">
          El motor de IA evaluará: <strong>salud del equipo</strong>, <strong>factor de uso</strong>,
          <strong>historial preventivo/correctivo</strong> y <strong>días para mantenimiento</strong>.
          Obtendrás recomendaciones específicas con los datos utilizados.
        </div>
      </div>`;
    return;
  }

  // ── Análisis del equipo seleccionado ─────────────────────
  const eq  = equipos.find(e=>e.id===eqId);
  if (!eq) return;

  const { c, hist, nCorr, nPrev, prod, recs } = iaAnalizar(eq);
  const colR = {crit:'rgba(239,68,68,.1)',warn:'rgba(245,158,11,.08)',ok:'rgba(34,197,94,.07)',info:'rgba(14,165,233,.07)'};
  const colB = {crit:'var(--red)',warn:'var(--yellow)',ok:'var(--green)',info:'var(--blue)'};

  const recsHTML = recs.length
    ? recs.map(r=>`
        <div style="background:${colR[r.nivel]};border-left:3px solid ${colB[r.nivel]};border-radius:var(--r);padding:13px 16px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
            <span style="font-size:1.2rem">${r.icono}</span>
            <div>
              <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:${colB[r.nivel]};font-weight:700;margin-bottom:2px">${r.tag}</div>
              <div style="font-size:.9rem;font-weight:800;color:var(--text)">${r.titulo}</div>
            </div>
          </div>
          <div style="font-size:.82rem;color:var(--text2);line-height:1.55;margin-bottom:8px">${r.desc}</div>
          <div style="font-size:.73rem;color:var(--text3);background:var(--bg);padding:6px 10px;border-radius:6px;font-family:var(--mono)">📊 ${r.base}</div>
        </div>`).join('')
    : `<div style="text-align:center;padding:24px;color:var(--green2)">✅ Sin recomendaciones — el equipo opera dentro de parámetros normales.</div>`;

  iaBody.innerHTML = `
    <!-- Header del equipo -->
    <div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--r2);padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-size:2rem">⚙️</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:1rem">${eq.nombre}</div>
        <div style="font-size:.78rem;color:var(--text3)">${eq.tipo}${eq.ubicacion?' · '+eq.ubicacion:''} · Factor ${eq.factor}x</div>
      </div>
      ${badge(c.estado)}
    </div>

    <!-- Stats rápidas -->
    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-card ${c.saludPct>70?'green':c.saludPct>40?'yellow':'red'}">
        <div class="stat-icon">❤️</div>
        <div class="stat-value">${c.saludPct}%</div>
        <div class="stat-label">Salud del Equipo</div>
        <div class="stat-sub">${c.saludPct>70?'Condición óptima':c.saludPct>40?'Requiere atención':'Intervención urgente'}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${c.diasMantenimiento}d</div>
        <div class="stat-label">Días para Mant.</div>
        <div class="stat-sub">${c.diasMantenimiento<=7?'⚡ Muy próximo':c.diasMantenimiento<=30?'Próximo':'Con margen'}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">🔴</div>
        <div class="stat-value">${nCorr}</div>
        <div class="stat-label">Correctivos</div>
        <div class="stat-sub">vs ${nPrev} preventivos</div>
      </div>
      <div class="stat-card ${prod.pct>=70?'green':prod.pct>=40?'yellow':'red'}">
        <div class="stat-icon">⏱</div>
        <div class="stat-value">${prod.pct}%</div>
        <div class="stat-label">Productividad</div>
        <div class="stat-sub">${prod.pct>=70?'Alta':'Baja'}</div>
      </div>
    </div>

    <!-- Gráfica de salud -->
    <div class="card" style="margin-bottom:13px">
      <div class="card-head">
        <span class="card-title">📊 Análisis Visual del Equipo</span>
        <span class="ai-badge">🧠 Generado por IA</span>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:center">
          <!-- Ring salud -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
            <div style="position:relative;width:130px;height:130px">
              <svg width="130" height="130" viewBox="0 0 130 130" style="transform:rotate(-90deg)">
                <circle cx="65" cy="65" r="45" fill="none" stroke="var(--border)" stroke-width="12"/>
                <circle cx="65" cy="65" r="45" fill="none" stroke="${sC(c.saludPct)}" stroke-width="12"
                  stroke-dasharray="${((c.saludPct/100)*2*Math.PI*45).toFixed(1)} ${(2*Math.PI*45).toFixed(1)}"
                  stroke-linecap="round" style="filter:drop-shadow(0 0 5px ${sC(c.saludPct)});transition:stroke-dasharray .6s ease"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
                <div style="font-size:1.4rem;font-weight:900;font-family:var(--mono);color:${sC2(c.saludPct)}">${c.saludPct}%</div>
                <div style="font-size:.62rem;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Salud</div>
              </div>
            </div>
            <div style="font-size:.75rem;color:var(--text3);text-align:center">Índice de Salud</div>
          </div>
          <!-- Barra desgaste -->
          <div style="display:flex;flex-direction:column;gap:10px">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:5px">
                <span style="color:var(--text3)">Desgaste</span>
                <span style="font-weight:700;color:${sC2(c.usoPct)}">${c.usoPct}%</span>
              </div>
              <div style="background:var(--border);border-radius:20px;height:10px;overflow:hidden">
                <div style="height:100%;width:${c.usoPct}%;background:${sC(100-c.usoPct)};border-radius:20px;transition:width .6s ease"></div>
              </div>
              <div style="font-size:.7rem;color:var(--text3);margin-top:3px">${c.horasAjustadas}h de ${eq.horasRec}h usadas</div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:5px">
                <span style="color:var(--text3)">Vida Útil Restante</span>
                <span style="font-weight:700;color:var(--blue2)">${Math.round((c.vidaRestante/eq.horasRec)*100)}%</span>
              </div>
              <div style="background:var(--border);border-radius:20px;height:10px;overflow:hidden">
                <div style="height:100%;width:${Math.round((c.vidaRestante/eq.horasRec)*100)}%;background:var(--blue);border-radius:20px;transition:width .6s ease"></div>
              </div>
              <div style="font-size:.7rem;color:var(--text3);margin-top:3px">${c.vidaRestante}h restantes · ${c.diasMantenimiento} días</div>
            </div>
          </div>
          <!-- Datos clave -->
          <div style="display:flex;flex-direction:column;gap:6px">
            ${[
              ['Factor de Uso', eq.factor+'x', eq.factor>=1.5?'var(--red2)':'var(--text)'],
              ['Horas Acumuladas', eq.horasAcum+'h', 'var(--text)'],
              ['Hrs Ajustadas', c.horasAjustadas+'h', 'var(--yellow2)'],
              ['Próximo Mant.', c.diasMantenimiento+'d', dC(c.diasMantenimiento)],
              ['Estado', c.estado==='ok'?'✅ Óptimo':c.estado==='warn'?'⚠️ Atención':'🔴 Crítico', sC2(c.saludPct)],
            ].map(([k,v,col])=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:.8rem">
                <span style="color:var(--text3)">${k}</span>
                <span style="font-weight:700;color:${col}">${v}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Metodología de cálculo — Transparencia académica -->
    <div class="card" style="margin-bottom:13px">
      <div class="card-head">
        <span class="card-title">📐 Metodología de Cálculo — Índice de Salud Operacional</span>
        <span class="ai-badge">📚 ISO 55000 / AHP</span>
      </div>
      <div class="card-body">
        <div style="font-size:.78rem;color:var(--text3);margin-bottom:10px;line-height:1.5">
          Modelo ponderado AHP (Saaty, 1980) · Pesos calibrados por matriz de comparación pareada (Razón de Consistencia CR=0.04)
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            ['x₁','Vida útil residual','VR/H_rec',c.x1,0.32,'Fracción de vida útil disponible según horas ajustadas vs. recomendadas por fabricante'],
            ['x₂','PMI (Índice TPM)','HM_prev/HM_total',c.x2,0.24,'Proporción de mantenimientos preventivos sobre el total (Nakajima, 1988 — TPM)'],
            ['x₃','Confiabilidad R(t)','e^(−λt)',c.x3,0.22,`Modelo exponencial de confiabilidad · λ=${c.lambda} fallas/h`],
            ['x₄','Factor de desgaste','1−(uso)^1.2',c.x4,0.14,'Curva de degradación no lineal tipo Weibull (β=1.2) por desgaste mecánico progresivo'],
            ['x₅','Disponibilidad A','MTBF/(MTBF+MTTR)',c.x5,0.08,'Disponibilidad inherente (MIL-HDBK-338B)'],
          ].map(([sym,nombre,formula,valor,peso,just])=>`
            <div style="background:var(--bg);border-radius:var(--r);padding:9px 12px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span style="font-size:.8rem;font-weight:700"><span style="color:var(--blue2)">${sym}</span> ${nombre}</span>
                <span style="font-family:var(--mono);font-size:.78rem"><span style="color:var(--text3)">w=${peso}</span> · <strong style="color:${valor>=0.7?'var(--green2)':valor>=0.4?'var(--yellow2)':'var(--red2)'}">${(valor*100).toFixed(1)}%</strong></span>
              </div>
              <div style="font-size:.7rem;color:var(--text3);font-family:var(--mono);margin-bottom:2px">${formula}</div>
              <div style="font-size:.72rem;color:var(--text3)">${just}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-family:var(--mono);font-size:.78rem;color:var(--text2);text-align:center">
          ISO = (0.32·x₁ + 0.24·x₂ + 0.22·x₃ + 0.14·x₄ + 0.08·x₅) × 100 = <strong style="color:${sC2(c.saludPct)}">${c.saludPct}%</strong>
        </div>
      </div>
    </div>

    <!-- KPIs de confiabilidad y costos -->
    <div class="card" style="margin-bottom:13px">
      <div class="card-head">
        <span class="card-title">📊 KPIs de Mantenimiento</span>
        <span class="ai-badge">📚 ISO 14224 · MIL-HDBK-338B</span>
      </div>
      <div class="card-body">
        <div class="rg-2" style="gap:8px;margin-bottom:12px">
          ${[
            ['MTBF','Tiempo Medio Entre Fallas',c.MTBF+'h','ISO 14224',c.MTBF<200?'var(--red2)':c.MTBF<500?'var(--yellow2)':'var(--green2)'],
            ['MTTR','Tiempo Medio de Reparación',c.MTTR+'h','EN 13306',c.MTTR>8?'var(--red2)':c.MTTR>4?'var(--yellow2)':'var(--green2)'],
            ['λ','Tasa de fallas',c.lambda+' f/h','Weibull β=1','var(--text2)'],
            ['R(t)','Confiabilidad exponencial',c.confiabilidad+'%','e^(−λt)','var(--text2)'],
            ['A','Disponibilidad inherente',c.disponibilidadPct+'%','MIL-HDBK-338B',c.disponibilidadPct<85?'var(--yellow2)':'var(--green2)'],
            ['PMI','Índice Mant. Preventivo',c.IMP+'%','TPM/JIPM',c.IMP<60?'var(--red2)':c.IMP<80?'var(--yellow2)':'var(--green2)'],
            ['IC','Índice de Criticidad',c.IC+'/100','RCM Jones 1995',c.IC>=70?'var(--red2)':c.IC>=40?'var(--yellow2)':'var(--green2)'],
            ['CAM','Costo Anual Mantenimiento','$'+c.costoTotal.toLocaleString(),'ISO 55000','var(--text2)'],
          ].map(([sym,nombre,val,ref,color])=>`
            <div style="background:var(--bg);border-radius:var(--r);padding:8px 11px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <span style="font-size:.7rem;color:var(--blue2);font-weight:700">${sym}</span>
                <span style="font-family:var(--mono);font-size:.82rem;font-weight:800;color:${color}">${val}</span>
              </div>
              <div style="font-size:.72rem;color:var(--text2);margin-top:1px">${nombre}</div>
              <div style="font-size:.65rem;color:var(--text3)">${ref}</div>
            </div>`).join('')}
        </div>
        ${c.costoIndisp>0||c.ahorroEstim>0?`
        <div style="background:rgba(14,165,233,.07);border:1px solid rgba(14,165,233,.2);border-radius:var(--r);padding:10px 13px;font-size:.79rem">
          <div style="font-weight:700;color:var(--blue2);margin-bottom:6px">💸 Análisis Económico (ISO 55000 §6.2)</div>
          <div class="rg-2" style="gap:4px">
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Preventivo/Predictivo</span><span class="kv-val">$${c.costoPrev.toLocaleString()} COP</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Correctivo</span><span class="kv-val">$${c.costoCorr.toLocaleString()} COP</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Indisponibilidad (${c.tiempoDet}h)</span><span class="kv-val">$${c.costoIndisp.toLocaleString()} COP</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Ahorro potencial (ratio 3.5:1)</span><span class="kv-val" style="color:var(--green2)">$${c.ahorroEstim.toLocaleString()} COP</span></div>
          </div>
        </div>`:''}
      </div>
    </div>

    <!-- Índice de Criticidad -->
    <div class="card" style="margin-bottom:13px">
      <div class="card-head">
        <span class="card-title">🎯 Índice de Criticidad (IC)</span>
        <span class="ai-badge">📚 RCM — Jones (1995)</span>
      </div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px">
          <div style="font-size:2.2rem;font-weight:900;font-family:var(--mono);color:${c.IC>=70?'var(--red2)':c.IC>=40?'var(--yellow2)':'var(--green2)'}">${c.IC}</div>
          <div>
            <div style="font-size:.85rem;font-weight:700">${c.nivelCriticidad==='alta'?'🔴 Criticidad Alta':c.nivelCriticidad==='media'?'⚠️ Criticidad Media':'✅ Criticidad Baja'}</div>
            <div style="font-size:.74rem;color:var(--text3)">IC = 0.30·S + 0.30·Oi + 0.25·F + 0.15·E — Jones (1995)</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mensaje inteligente de costos -->
    <div class="card" style="margin-bottom:13px">
      <div class="card-head">
        <span class="card-title">💸 Análisis Inteligente de Costos</span>
        <span class="ai-badge">🧠 IA</span>
      </div>
      <div class="card-body">
        ${(()=>{
          const mts   = mantenimientos.filter(m=>m.equipoId===eq.id);
          const nCorr = mts.filter(m=>m.tipo==='Correctivo').length;
          const nPrev = mts.filter(m=>m.tipo==='Preventivo').length;
          const costCorr = mts.filter(m=>m.tipo==='Correctivo').reduce((s,m)=>s+(m.costo||0),0);
          const costPrev = mts.filter(m=>m.tipo==='Preventivo').reduce((s,m)=>s+(m.costo||0),0);
          const totalCost = costCorr + costPrev;
          const ahorroPotencial = costCorr * (1 - 1/FACTOR_CORR);

          if (!mts.length) return `
            <div style="padding:12px;background:rgba(14,165,233,.06);border-radius:var(--r);border-left:3px solid var(--blue);font-size:.83rem;color:var(--text2)">
              📋 <strong>Sin historial de mantenimiento registrado.</strong> Registra mantenimientos para que el sistema genere un análisis de costos detallado.
            </div>`;

          const nivel  = costCorr > costPrev ? 'crit' : nCorr > 0 ? 'warn' : 'ok';
          const colores = {crit:'rgba(239,68,68,.08)',warn:'rgba(245,158,11,.08)',ok:'rgba(34,197,94,.07)'};
          const bordes  = {crit:'var(--red)',warn:'var(--yellow)',ok:'var(--green)'};
          const iconos  = {crit:'🔴',warn:'⚠️',ok:'✅'};

          let msg = '';
          if (nivel==='crit') {
            msg = `El <strong>${Math.round(costCorr/totalCost*100)}%</strong> del gasto en este equipo (${fmtCop(costCorr)}) corresponde a mantenimientos <strong>correctivos no planificados</strong>. Esto es ~${FACTOR_CORR}× más caro que un mantenimiento preventivo equivalente. Implementar un plan preventivo estructurado podría generar un ahorro potencial de <strong style="color:var(--green2)">${fmtCop(ahorroPotencial)}</strong>.`;
          } else if (nivel==='warn') {
            msg = `Se registran ${nCorr} mantenimiento${nCorr>1?'s':''} correctivo${nCorr>1?'s':''} (${fmtCop(costCorr)}) y ${nPrev} preventivo${nPrev>1?'s':''} (${fmtCop(costPrev)}). Aumentar la frecuencia de mantenimientos preventivos puede reducir los costos operativos del equipo.`;
          } else {
            msg = `Excelente gestión. El <strong>${Math.round(costPrev/(totalCost||1)*100)}%</strong> del gasto (${fmtCop(costPrev)}) corresponde a mantenimientos preventivos. Esta estrategia es la más eficiente en términos de costo-beneficio industrial.`;
          }

          return `
            <div style="background:${colores[nivel]};border-left:3px solid ${bordes[nivel]};border-radius:var(--r);padding:12px 15px;font-size:.83rem;color:var(--text2);line-height:1.6;margin-bottom:12px">
              ${iconos[nivel]} ${msg}
            </div>
            <div class="rg-3">
              <div style="text-align:center;background:var(--bg);border-radius:var(--r);padding:10px">
                <div style="font-size:1.1rem;font-weight:800;font-family:var(--mono);color:var(--blue2)">${fmtCop(totalCost)}</div>
                <div class="cls-meta-xs">Gasto Total</div>
              </div>
              <div style="text-align:center;background:rgba(34,197,94,.07);border-radius:var(--r);padding:10px">
                <div style="font-size:1.1rem;font-weight:800;font-family:var(--mono);color:var(--green2)">${fmtCop(costPrev)}</div>
                <div class="cls-meta-xs">Preventivo</div>
              </div>
              <div style="text-align:center;background:rgba(239,68,68,.07);border-radius:var(--r);padding:10px">
                <div style="font-size:1.1rem;font-weight:800;font-family:var(--mono);color:var(--red2)">${fmtCop(costCorr)}</div>
                <div class="cls-meta-xs">Correctivo</div>
              </div>
            </div>`;
        })()}
      </div>
    </div>

    <!-- Recomendaciones generales -->
    <div class="card" style="margin-bottom:13px">
      <div class="card-head">
        <span class="card-title">🎯 Recomendaciones IA para ${eq.nombre}</span>
        <span class="ai-badge">🧠 ${recs.length} recomendación${recs.length!==1?'es':''}</span>
      </div>
      <div class="card-body">${recsHTML}</div>
    </div>

    <!-- TRANSPORTE: Plan de mantenimiento IA + Control documental -->
    <!-- CONSTRUCCIÓN: Análisis maquinaria pesada -->
    ${getTipoEmpresa()==='construccion' ? (()=>{
      const mia = calcularMantenimientoIAConstruccion(eq);
      const urgColor ={vencido:'var(--red)',critico:'var(--red)',proximo:'var(--yellow)',ok:'var(--green)'};
      const urgLabel ={vencido:'🔴 VENCIDO',critico:'🔴 Crítico',proximo:'⚠️ Próximo',ok:'✅ OK'};
      const riesgoC  ={critico:'var(--red)',alto:'var(--red)',medio:'var(--yellow)',bajo:'var(--green)'};
      const riesgoBg ={critico:'rgba(220,53,53,.08)',alto:'rgba(220,53,53,.06)',medio:'rgba(212,150,12,.07)',bajo:'rgba(58,170,92,.06)'};
      const riesgoL  ={critico:'🔴 Riesgo Crítico',alto:'🔴 Riesgo Alto',medio:'⚠️ Riesgo Medio',bajo:'✅ Riesgo Bajo'};
      const urgMant  = mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').length;

      const alertasHTML = mia.alertas.length ? mia.alertas.map(a=>`
        <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:1.1rem;flex-shrink:0">${a.icono}</span>
          <span style="font-size:.82rem;color:var(--text2);line-height:1.5;flex:1">${a.msg}</span>
          <span style="font-size:.7rem;font-weight:700;color:${a.tipo==='crit'?'var(--red2)':'var(--yellow2)'};flex-shrink:0">${a.tipo==='crit'?'CRÍTICO':'ALERTA'}</span>
        </div>`).join('') :
        `<div style="text-align:center;padding:14px;color:var(--green2);font-size:.83rem">✅ Sin alertas activas en maquinaria pesada</div>`;

      const planHTML = mia.horasOp > 0 ? mia.plan.map(m=>`
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:1rem;flex-shrink:0">${m.icono}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.84rem;font-weight:700">${m.nombre}</div>
            <div style="font-size:.72rem;color:var(--text3)">Intervalo IA: ${m.intervaloReal.toLocaleString()}h · Factor ${m.factorAplicado.toFixed(2)}× · ${m.horasRestantes.toLocaleString()}h restantes</div>
            <div style="background:var(--border);border-radius:20px;height:5px;margin-top:5px;overflow:hidden">
              <div style="height:100%;width:${m.pctCompletado}%;background:${urgColor[m.urgencia]};border-radius:20px"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:.72rem;font-weight:700;color:${urgColor[m.urgencia]}">${urgLabel[m.urgencia]}</div>
            <div style="font-size:.68rem;color:var(--text3)">${m.pctCompletado}%</div>
          </div>
        </div>`).join('') :
        `<div style="text-align:center;padding:16px;color:var(--text3);font-size:.82rem">Registra las horas máquina actuales y las horas del último mantenimiento para generar el plan IA.</div>`;

      return `
        <!-- Resumen IA maquinaria -->
        <div style="background:${riesgoBg[mia.nivelRiesgo]};border:1px solid ${riesgoC[mia.nivelRiesgo]};border-radius:var(--r2);padding:14px 16px;margin-bottom:13px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--blue2)">🏗️ Análisis IA — Maquinaria Pesada</div>
            <div style="font-size:.9rem;font-weight:800;color:${riesgoC[mia.nivelRiesgo]}">${riesgoL[mia.nivelRiesgo]} — ${mia.riesgo}/100</div>
          </div>
          <div style="background:var(--border);border-radius:20px;height:10px;overflow:hidden;margin-bottom:10px">
            <div style="height:100%;width:${mia.riesgo}%;background:${riesgoC[mia.nivelRiesgo]};border-radius:20px;transition:width .8s"></div>
          </div>
          <div class="rg-2" style="font-size:.8rem;gap:6px">
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Tipo maquinaria</span><span class="kv-val">${mia.tipoMaq||'—'}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Operador</span><span class="kv-val">${mia.operador}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Nivel de exigencia</span><span class="kv-val">${mia.nivel.split('—')[0].trim()}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Factor IA aplicado</span><span class="kv-val" style="color:var(--blue2);font-weight:800">${mia.factorComb.toFixed(2)}×</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Estado hidráulico</span><span class="kv-val" style="color:${mia.estadoHid==='Óptimo'?'var(--green2)':'var(--red2)'}">${mia.estadoHid}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Horas desde último mant.</span><span class="kv-val">${mia.horasOp.toLocaleString()}h</span></div>
            ${mia.presHid>0?`<div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Presión hidráulica</span><span class="kv-val" style="color:${mia.presHid>225?'var(--red2)':'var(--green2)'}">${mia.presHid} bar</span></div>`:''}
            ${mia.temp>0?`<div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Temperatura motor</span><span class="kv-val" style="color:${mia.temp>95?'var(--red2)':'var(--green2)'}">${mia.temp}°C</span></div>`:''}
          </div>
          <div style="font-size:.78rem;color:var(--text2);margin-top:10px;line-height:1.5;border-top:1px solid ${riesgoC[mia.nivelRiesgo]};padding-top:8px">
            ${mia.nivelRiesgo==='critico'
              ? `🔴 <strong>Riesgo crítico.</strong> La maquinaria presenta condiciones de operación que representan riesgo inminente. Paralizar operaciones y realizar inspección técnica urgente. Notificar al director de obra.`
              : mia.nivelRiesgo==='alto'
              ? `🔴 <strong>Riesgo alto.</strong> Múltiples indicadores técnicos fuera de parámetros. Programar revisión técnica especializada en las próximas 24 horas.`
              : mia.nivelRiesgo==='medio'
              ? `⚠️ <strong>Riesgo medio.</strong> Algunos indicadores requieren atención. Monitorear de cerca y planificar mantenimiento preventivo en los próximos días.`
              : `✅ <strong>Riesgo bajo.</strong> La maquinaria opera dentro de parámetros normales. Continuar con el plan preventivo IA.`}
          </div>
        </div>

        <!-- Alertas hidráulicas y estructurales -->
        <div class="card" style="margin-bottom:13px">
          <div class="card-head">
            <span class="card-title">🔍 Estado Hidráulico y Estructural</span>
            <span class="ai-badge">${mia.alertas.filter(a=>a.tipo==='crit').length>0?'🔴 '+mia.alertas.filter(a=>a.tipo==='crit').length+' crítica'+(mia.alertas.filter(a=>a.tipo==='crit').length>1?'s':''):mia.alertas.length>0?'⚠️ '+mia.alertas.length+' alerta'+(mia.alertas.length>1?'s':''):'✅ OK'}</span>
          </div>
          <div class="card-body">${alertasHTML}</div>
        </div>

        <!-- Plan de mantenimiento IA Construcción -->
        <div class="card">
          <div class="card-head">
            <span class="card-title">🔧 Plan de Mantenimiento IA — ${eq.nombre||mia.tipoMaq||eq.tipo}</span>
            <span class="ai-badge">${urgMant>0?'🔴 '+urgMant+' urgente'+(urgMant>1?'s':''):'✅ Al día'}</span>
          </div>
          <div class="card-body">${planHTML}</div>
        </div>

        <!-- Info de obra -->
        ${(mia.ubObra!=='N/A'||mia.proyecto!=='N/A')?`
        <div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--r);padding:11px 14px;margin-top:10px;font-size:.8rem;color:var(--text2)">
          📍 <strong>Ubicación:</strong> ${mia.ubObra} &nbsp;·&nbsp; 🏗️ <strong>Proyecto:</strong> ${mia.proyecto}
        </div>`:''}`;
    })() : ''}

    <!-- INDUSTRIAL: Análisis operacional completo -->
    ${getTipoEmpresa()==='industrial' ? (()=>{
      const mia = calcularMantenimientoIAIndustrial(eq);
      const urgColor={vencido:'var(--red)',critico:'var(--red)',proximo:'var(--yellow)',ok:'var(--green)'};
      const urgBg   ={vencido:'rgba(220,53,53,.08)',critico:'rgba(220,53,53,.07)',proximo:'rgba(212,150,12,.07)',ok:'rgba(58,170,92,.06)'};
      const urgLabel={vencido:'🔴 VENCIDO',critico:'🔴 Crítico',proximo:'⚠️ Próximo',ok:'✅ OK'};
      const riesgoColor={critico:'var(--red)',alto:'var(--red)',medio:'var(--yellow)',bajo:'var(--green)'};
      const riesgoBg   ={critico:'rgba(220,53,53,.08)',alto:'rgba(220,53,53,.06)',medio:'rgba(212,150,12,.07)',bajo:'rgba(58,170,92,.06)'};
      const riesgoLabel={critico:'🔴 Riesgo Crítico',alto:'🔴 Riesgo Alto',medio:'⚠️ Riesgo Medio',bajo:'✅ Riesgo Bajo'};

      // Gauge de riesgo visual
      const gaugeW = Math.round(mia.riesgo);
      const gaugeColor = mia.riesgo>=70?'var(--red)':mia.riesgo>=40?'var(--yellow)':'var(--green)';

      // Anomalías
      const anomHTML = mia.anomalias.length ? mia.anomalias.map(a=>`
        <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:1.1rem;flex-shrink:0">${a.icono}</span>
          <span style="font-size:.82rem;color:var(--text2);line-height:1.5">${a.msg}</span>
          <span style="font-size:.7rem;font-weight:700;color:${a.tipo==='crit'?'var(--red2)':'var(--yellow2)'};flex-shrink:0">${a.tipo==='crit'?'CRÍTICO':'ALERTA'}</span>
        </div>`).join('') :
        `<div style="text-align:center;padding:14px;color:var(--green2);font-size:.83rem">✅ Sin anomalías detectadas en las variables de monitoreo</div>`;

      // Plan de mantenimiento IA
      const urgMant = mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').length;
      const planHTML = mia.horasOp > 0 ? mia.plan.map(m=>`
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:1rem;flex-shrink:0">${m.icono}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.84rem;font-weight:700">${m.nombre}</div>
            <div style="font-size:.72rem;color:var(--text3)">Intervalo IA: ${m.intervaloReal.toLocaleString()}h · Factor ${m.factorAplicado.toFixed(2)}× · ${m.horasRestantes.toLocaleString()}h restantes</div>
            <div style="background:var(--border);border-radius:20px;height:5px;margin-top:5px;overflow:hidden">
              <div style="height:100%;width:${m.pctCompletado}%;background:${urgColor[m.urgencia]};border-radius:20px"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:.72rem;font-weight:700;color:${urgColor[m.urgencia]}">${urgLabel[m.urgencia]}</div>
            <div style="font-size:.68rem;color:var(--text3)">${m.pctCompletado}%</div>
          </div>
        </div>`).join('') :
        `<div style="text-align:center;padding:16px;color:var(--text3);font-size:.82rem">Registra las horas acumuladas y horas del último mantenimiento para generar el plan IA.</div>`;

      return `
        <!-- Índice de Riesgo Operacional -->
        <div style="background:${riesgoBg[mia.nivelRiesgo]};border:1px solid ${riesgoColor[mia.nivelRiesgo]};border-radius:var(--r2);padding:14px 16px;margin-bottom:13px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--blue2)">🎯 Índice de Riesgo Operacional IA</div>
            <div style="font-size:.9rem;font-weight:800;color:${riesgoColor[mia.nivelRiesgo]}">${riesgoLabel[mia.nivelRiesgo]} — ${mia.riesgo}/100</div>
          </div>
          <div style="background:var(--border);border-radius:20px;height:10px;overflow:hidden;margin-bottom:10px">
            <div style="height:100%;width:${gaugeW}%;background:${gaugeColor};border-radius:20px;transition:width .8s ease"></div>
          </div>
          <div class="rg-2" style="font-size:.8rem;gap:6px">
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Condición trabajo</span><span class="kv-val">${mia.condTrab}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Criticidad</span><span class="kv-val">${mia.criticidad.split('—')[0].trim()}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Factor IA aplicado</span><span class="kv-val" style="color:var(--blue2);font-weight:800">${mia.factorComb.toFixed(2)}×</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Horas desde último mant.</span><span class="kv-val">${mia.horasOp.toLocaleString()}h</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Vibración</span><span class="kv-val" style="color:${mia.vibracion>4.5?'var(--red2)':'var(--green2)'}">${mia.vibracion||'—'} mm/s</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Temperatura</span><span class="kv-val" style="color:${mia.temp>85?'var(--red2)':'var(--green2)'}">${mia.temp||'—'}°C</span></div>
          </div>
          <div style="font-size:.78rem;color:var(--text2);margin-top:10px;line-height:1.5;border-top:1px solid ${riesgoColor[mia.nivelRiesgo]};padding-top:8px">
            ${mia.nivelRiesgo==='critico'
              ? `🔴 <strong>Riesgo crítico detectado.</strong> El equipo presenta múltiples indicadores fuera de parámetros. Se recomienda detener la operación y realizar una inspección técnica inmediata para evitar falla catastrófica.`
              : mia.nivelRiesgo==='alto'
              ? `🔴 <strong>Riesgo alto.</strong> Varios indicadores operacionales se encuentran en niveles de alerta. Programar inspección preventiva prioritaria dentro de las próximas 24-48 horas.`
              : mia.nivelRiesgo==='medio'
              ? `⚠️ <strong>Riesgo medio.</strong> Algunos parámetros requieren atención. Monitorear de cerca y programar mantenimiento preventivo en los próximos días.`
              : `✅ <strong>Riesgo bajo.</strong> El equipo opera dentro de parámetros normales. Continuar con el plan de mantenimiento preventivo establecido por la IA.`}
          </div>
        </div>

        <!-- Anomalías detectadas -->
        <div class="card" style="margin-bottom:13px">
          <div class="card-head">
            <span class="card-title">🔍 Monitoreo de Variables Operacionales</span>
            <span class="ai-badge">${mia.anomalias.length>0?'⚠️ '+mia.anomalias.length+' anomalía'+(mia.anomalias.length>1?'s':''):'✅ Normal'}</span>
          </div>
          <div class="card-body">${anomHTML}</div>
        </div>

        <!-- Plan de mantenimiento IA Industrial -->
        <div class="card">
          <div class="card-head">
            <span class="card-title">🔧 Plan de Mantenimiento IA — ${eq.nombre||eq.tipo}</span>
            <span class="ai-badge">${urgMant>0?'🔴 '+urgMant+' urgente'+(urgMant>1?'s':''):'✅ Al día'}</span>
          </div>
          <div class="card-body">${planHTML}</div>
        </div>`;
    })() : ''}

    ${getTipoEmpresa()==='transporte' ? (()=>{
      const mia = calcularMantenimientoIA(eq);
      const urgColor = {vencido:'var(--red)',critico:'var(--red)',proximo:'var(--yellow)',ok:'var(--green)'};
      const urgBg    = {vencido:'rgba(220,53,53,.08)',critico:'rgba(220,53,53,.06)',proximo:'rgba(212,150,12,.07)',ok:'rgba(58,170,92,.06)'};
      const urgLabel = {vencido:'🔴 VENCIDO',critico:'🔴 Crítico',proximo:'⚠️ Próximo',ok:'✅ OK'};

      // Plan mantenimiento
      const planHTML = mia.plan.map(m=>`
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:1.1rem;flex-shrink:0">${m.icono}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.84rem;font-weight:700">${m.nombre}</div>
            <div style="font-size:.72rem;color:var(--text3)">Intervalo IA: ${m.intervaloReal.toLocaleString()} km · Factor ${m.factorAplicado}× · ${m.kmRestantes.toLocaleString()} km restantes</div>
            <div style="background:var(--border);border-radius:20px;height:5px;margin-top:5px;overflow:hidden">
              <div style="height:100%;width:${m.pctCompletado}%;background:${urgColor[m.urgencia]};border-radius:20px;transition:width .6s"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:.72rem;font-weight:700;color:${urgColor[m.urgencia]}">${urgLabel[m.urgencia]}</div>
            <div style="font-size:.68rem;color:var(--text3)">${m.pctCompletado}% completado</div>
          </div>
        </div>`).join('');

      // Documentos
      const docsHTML = mia.docs.map(d=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:.83rem;font-weight:600">${d.nombre}</div>
          ${d.estado==='no_registrado'
            ? `<span style="font-size:.72rem;color:var(--text3)">No registrado</span>`
            : `<div style="text-align:right">
                <div style="font-size:.72rem;font-weight:700;color:${urgColor[d.estado]}">${urgLabel[d.estado]}</div>
                <div style="font-size:.68rem;color:var(--text3)">${d.diasRestantes<0?'Vencido hace '+Math.abs(d.diasRestantes)+'d':d.diasRestantes===0?'Vence hoy':'Vence en '+d.diasRestantes+'d'} · ${d.fechaVenc}</div>
              </div>`}
        </div>`).join('');

      const vencDocs = mia.docs.filter(d=>d.estado==='vencido').length;
      const critDocs = mia.docs.filter(d=>d.estado==='critico').length;
      const urgMant  = mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').length;

      return `
        <!-- Resumen del factor IA -->
        <div style="background:rgba(14,165,233,.07);border:1px solid rgba(14,165,233,.2);border-radius:var(--r2);padding:13px 16px;margin-bottom:13px">
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--blue2);margin-bottom:8px">🤖 Factor de Ajuste IA</div>
          <div class="rg-2" style="font-size:.81rem;gap:6px">
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Condición operativa</span><span class="kv-val">${mia.condOp}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Año del vehículo</span><span class="kv-val">${mia.anio||'N/A'}</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Factor de ajuste total</span><span class="kv-val" style="color:var(--blue2);font-weight:800">${mia.factorComb.toFixed(2)}×</span></div>
            <div class="kv-row" style="border:none;padding:2px 0"><span class="kv-key">Km desde último mant.</span><span class="kv-val">${mia.recorrido.toLocaleString()} km</span></div>
          </div>
          <div style="font-size:.78rem;color:var(--text2);margin-top:8px;line-height:1.5">
            ${mia.factorComb < 0.75
              ? `🔴 El vehículo opera en condiciones exigentes (factor ${mia.factorComb.toFixed(2)}×). Los intervalos de mantenimiento se han reducido significativamente respecto al estándar del fabricante.`
              : mia.factorComb < 0.90
              ? `⚠️ Condiciones de operación moderadamente exigentes (factor ${mia.factorComb.toFixed(2)}×). Se aplica reducción de intervalos para garantizar la confiabilidad del vehículo.`
              : `✅ El vehículo opera en condiciones normales (factor ${mia.factorComb.toFixed(2)}×). Los intervalos de mantenimiento se aplican según las especificaciones del fabricante.`}
          </div>
        </div>

        <!-- Plan de mantenimiento IA -->
        <div class="card" style="margin-bottom:13px">
          <div class="card-head">
            <span class="card-title">🔧 Plan de Mantenimiento IA — ${eq.nombre||eq.tipo}</span>
            <span class="ai-badge">${urgMant>0?'🔴 '+urgMant+' urgente'+(urgMant>1?'s':''):'✅ Al día'}</span>
          </div>
          <div class="card-body">${mia.recorrido>0?planHTML:`<div style="text-align:center;padding:16px;color:var(--text3);font-size:.82rem">Registra el kilometraje actual y el km del último mantenimiento para generar el plan IA.</div>`}</div>
        </div>

        <!-- Control documental -->
        <div class="card">
          <div class="card-head">
            <span class="card-title">📋 Control Documental</span>
            <span class="ai-badge">${vencDocs>0?'🔴 '+vencDocs+' vencido'+(vencDocs>1?'s':''):critDocs>0?'⚠️ '+critDocs+' crítico'+(critDocs>1?'s':''):'✅ Al día'}</span>
          </div>
          <div class="card-body">${docsHTML}</div>
        </div>`;
    })() : ''}`;
}

function renderAlertas() {
  const filtro=(document.getElementById('alerta-filtro')||{}).value||'all';
  const all=equipos.map(e=>({eq:e,c:calcEquipo(e)}));
  const crits=all.filter(x=>x.c.estado==='crit').length;
  const warns=all.filter(x=>x.c.estado==='warn').length;
  const oks=all.filter(x=>x.c.estado==='ok').length;

  document.getElementById('alerta-stats').innerHTML = `
    <div class="card"><div class="card-body" style="text-align:center;padding:14px"><div style="font-size:1.7rem;font-weight:800;font-family:var(--mono);color:var(--red2)">${crits}</div><div class="cls-stat-sub">Críticos</div></div></div>
    <div class="card"><div class="card-body" style="text-align:center;padding:14px"><div style="font-size:1.7rem;font-weight:800;font-family:var(--mono);color:var(--yellow2)">${warns}</div><div class="cls-stat-sub">Advertencias</div></div></div>
    <div class="card"><div class="card-body" style="text-align:center;padding:14px"><div style="font-size:1.7rem;font-weight:800;font-family:var(--mono);color:var(--green2)">${oks}</div><div class="cls-stat-sub">En Buen Estado</div></div></div>`;

  let data=all;
  if(filtro==='crit') data=all.filter(x=>x.c.estado==='crit');
  else if(filtro==='warn') data=all.filter(x=>x.c.estado==='warn');
  else if(filtro==='ok')   data=all.filter(x=>x.c.estado==='ok');

  document.getElementById('alertas-list').innerHTML = data.sort((a,b)=>a.c.saludPct-b.c.saludPct).map(({eq,c})=>`
    <div class="alert-row ar-${c.estado}">
      <div style="font-size:1.2rem">${c.estado==='crit'?'🔴':c.estado==='warn'?'⚠️':'✅'}</div>
      <div class="ar-info">
        <div class="ar-title">${eq.nombre} <span style="font-size:.73rem;color:var(--text3)">— ${eq.tipo}</span></div>
        <div class="ar-sub">${c.diasMantenimiento===0?'⚡ MANTENIMIENTO URGENTE AHORA':c.diasMantenimiento+'d para próximo mantenimiento'} · Salud ${c.saludPct}% · Hrs ajustadas: ${c.horasAjustadas}h</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        ${pb(c.saludPct)}
        <button class="btn btn-warn btn-xs" onclick="irAMant(${eq.id})">🔧 Mantener</button>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════
//  HISTORIAL
// ══════════════════════════════════════════════
function renderHistorial() {
  const sel=document.getElementById('hist-filtro-eq');
  if(sel&&sel.options.length<=1){
    equipos.forEach(e=>{ const o=document.createElement('option'); o.value=e.id; o.textContent=e.nombre; sel.appendChild(o); });
  }
  const eqF=(document.getElementById('hist-filtro-eq')||{}).value||'all';
  const tiF=(document.getElementById('hist-filtro-tipo')||{}).value||'all';
  let data=[...mantenimientos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  if(eqF!=='all') data=data.filter(m=>m.equipoId===+eqF);
  if(tiF!=='all') data=data.filter(m=>m.tipo===tiF);

  const totalCosto=mantenimientos.reduce((s,m)=>s+(m.costo||0),0);
  const nPrev=mantenimientos.filter(m=>m.tipo==='Preventivo').length;
  const nCorr=mantenimientos.filter(m=>m.tipo==='Correctivo').length;
  const pctCorr=mantenimientos.length>0?Math.round(nCorr/mantenimientos.length*100):0;

  document.getElementById('hist-stats').innerHTML = `
    <div class="card"><div class="card-body" style="text-align:center;padding:13px"><div style="font-size:1.65rem;font-weight:800;font-family:var(--mono);color:var(--blue2)">${mantenimientos.length}</div><div class="cls-stat-sub">Total Registros</div></div></div>
    <div class="card"><div class="card-body" style="text-align:center;padding:13px"><div style="font-size:1.65rem;font-weight:800;font-family:var(--mono);color:var(--green2)">${nPrev}</div><div class="cls-stat-sub">Preventivos</div></div></div>
    <div class="card"><div class="card-body" style="text-align:center;padding:13px"><div style="font-size:1.65rem;font-weight:800;font-family:var(--mono);color:var(--red2)">${nCorr}</div><div class="cls-stat-sub">Correctivos</div></div></div>`;

  // ── Análisis IA del historial ──────────────────────────
  const iaHistEl = document.getElementById('hist-ia-analisis');
  if (iaHistEl && mantenimientos.length >= 2) {
    // Equipo con más correctivos
    const corrPorEq = {};
    mantenimientos.filter(m=>m.tipo==='Correctivo').forEach(m=>{
      corrPorEq[m.equipoNombre] = (corrPorEq[m.equipoNombre]||0)+1;
    });
    const topCorr = Object.entries(corrPorEq).sort((a,b)=>b[1]-a[1])[0];
    // Tendencia reciente (últimos 3 vs anteriores)
    const sorted = [...mantenimientos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
    const recientes = sorted.slice(0,Math.min(3,sorted.length));
    const corrReciente = recientes.filter(m=>m.tipo==='Correctivo').length;
    const tendencia = corrReciente >= 2 ? 'correctiva creciente' : corrReciente === 0 ? 'preventiva' : 'mixta';
    // Costo promedio
    const mantConCosto = mantenimientos.filter(m=>m.costo>0);
    const costoPromedio = mantConCosto.length>0 ? Math.round(mantConCosto.reduce((s,m)=>s+m.costo,0)/mantConCosto.length) : 0;

    let iaMsg = '';
    let nivelColor = 'var(--blue)';
    if (pctCorr > 60) {
      nivelColor = 'var(--red)';
      iaMsg = `El historial revela un <strong>patrón de mantenimiento predominantemente reactivo</strong>: el <strong>${pctCorr}% de las intervenciones son correctivas</strong> (${nCorr} de ${mantenimientos.length}). ${topCorr ? `El equipo <strong>${topCorr[0]}</strong> concentra ${topCorr[1]} intervenciones correctivas, siendo el activo más problemático de la flota.` : ''} La tendencia reciente es <strong>${tendencia}</strong>. Este patrón operativo genera costos significativamente más altos que una estrategia preventiva estructurada. ${costoPromedio>0?`El costo promedio por intervención registrado es <strong>${fmtCop(costoPromedio)}</strong>.`:''}`;
    } else if (pctCorr > 30) {
      nivelColor = 'var(--yellow)';
      iaMsg = `El historial muestra una <strong>estrategia de mantenimiento mixta</strong> con ${nPrev} intervenciones preventivas y ${nCorr} correctivas. La tendencia reciente es <strong>${tendencia}</strong>. ${topCorr&&topCorr[1]>1?`El equipo <strong>${topCorr[0]}</strong> requiere especial atención con ${topCorr[1]} correctivos registrados.`:''} Incrementar la proporción de mantenimientos preventivos puede reducir los costos operativos y aumentar la disponibilidad de los equipos. ${costoPromedio>0?`Costo promedio por intervención: <strong>${fmtCop(costoPromedio)}</strong>.`:''}`;
    } else if (mantenimientos.length > 0) {
      nivelColor = 'var(--green)';
      iaMsg = `El historial evidencia una <strong>estrategia de mantenimiento preventivo sólida</strong>: el <strong>${100-pctCorr}% de las intervenciones son planificadas</strong> (${nPrev} preventivos). La tendencia reciente es <strong>${tendencia}</strong>. Este enfoque proactivo es consistente con las mejores prácticas de gestión de activos industriales, reduciendo el riesgo de fallas no programadas y optimizando los costos operativos. ${costoPromedio>0?`Costo promedio por intervención: <strong>${fmtCop(costoPromedio)}</strong>.`:''}`;
    }

    if (iaMsg) {
      iaHistEl.innerHTML = `
        <div style="background:var(--s2);border:1px solid var(--border);border-radius:var(--r2);padding:14px 18px;margin-bottom:16px;border-left:4px solid ${nivelColor}">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--blue2);margin-bottom:7px">🧠 Análisis IA del Historial</div>
          <div style="font-size:.83rem;color:var(--text2);line-height:1.7">${iaMsg}</div>
        </div>`;
    } else {
      iaHistEl.innerHTML = '';
    }
  } else if (iaHistEl) {
    iaHistEl.innerHTML = '';
  }

  document.getElementById('hist-count').textContent = `${data.length} registros mostrados`;
  document.getElementById('hist-list').innerHTML = data.length
    ? data.map(m=>`
      <div class="tl-item">
        <div class="tl-left"><div class="tl-dot ${m.tipo==='Preventivo'?'prev':m.tipo==='Correctivo'?'corr':'pred'}"></div><div class="tl-line"></div></div>
        <div class="tl-body">
          <div class="tl-title">${m.equipoNombre}</div>
          <div class="tl-meta">${m.tipo}${m.tecnico?' · '+m.tecnico:''}</div>
          <div class="tl-desc">${m.desc}</div>
        </div>
        <div class="tl-right">
          <div class="tl-date">${fmtDate(m.fecha)}</div>
          <div class="tl-badge">${badge(m.tipo==='Preventivo'?'ok':m.tipo==='Correctivo'?'crit':'info')}</div>
          ${m.costo?`<div style="font-size:.73rem;font-family:var(--mono);color:var(--green2);margin-top:3px">${fmtCop(m.costo)}</div>`:''}
        </div>
      </div>`).join('')
    : `<div class="empty"><div class="empty-icon">📋</div><p>Sin registros con este filtro</p></div>`;
}

// ══════════════════════════════════════════════
//  MANTENIMIENTO
// ══════════════════════════════════════════════
function renderMantenimientoView() {
  const sel=document.getElementById('m-equipo');
  if(sel){ sel.innerHTML='<option value="">— Seleccionar equipo —</option>'+equipos.map(e=>`<option value="${e.id}">${e.nombre}</option>`).join(''); }
  const fi=document.getElementById('m-fecha');
  if(fi) fi.value=new Date().toISOString().slice(0,10);
  updateMantPreview();
}

function updateMantPreview() {
  const id=+document.getElementById('m-equipo').value;
  const eq=equipos.find(e=>e.id===id);
  const p=document.getElementById('mant-preview');
  if(!eq){p.innerHTML='<div class="empty"><div class="empty-icon">⚙️</div><p>Selecciona un equipo</p></div>';return;}
  const c=calcEquipo(eq);
  p.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;font-family:var(--mono);color:${sC2(c.saludPct)}">${c.saludPct}%</div><div style="font-size:.68rem;color:var(--text3);text-transform:uppercase">Salud Actual</div></div>
      <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;font-family:var(--mono);color:${dC(c.diasMantenimiento)}">${c.diasMantenimiento}d</div><div style="font-size:.68rem;color:var(--text3);text-transform:uppercase">Días p/Mant.</div></div>
    </div>
    <div class="kv-row"><span class="kv-key">Estado</span><span>${badge(c.estado)}</span></div>
    <div class="kv-row"><span class="kv-key">Horas Acumuladas</span><span class="kv-val" style="color:var(--blue2)">${eq.horasAcum}h</span></div>
    <div class="kv-row"><span class="kv-key">Horas Ajustadas (×${eq.factor})</span><span class="kv-val" style="color:var(--yellow2)">${c.horasAjustadas}h</span></div>
    <div class="kv-row"><span class="kv-key">Vida Restante</span><span class="kv-val" style="color:var(--green2)">${c.vidaRestante}h</span></div>
    <div style="margin-top:10px;padding:8px;background:rgba(34,197,94,.06);border-radius:var(--r);border-left:3px solid var(--green);font-size:.78rem;color:var(--text2)">
      💡 Al registrar un mantenimiento <strong>Preventivo o Predictivo</strong>, las horas acumuladas se reiniciarán a 0. Los mantenimientos <strong>Correctivos</strong> no reinician el ciclo.
    </div>`;
}

function registrarMantenimiento() {
  const id=+document.getElementById('m-equipo').value;
  const tipo=document.getElementById('m-tipo').value;
  const fecha=document.getElementById('m-fecha').value;
  const tecnico=document.getElementById('m-tecnico').value.trim();
  const desc=document.getElementById('m-desc').value.trim();
  const costo=+document.getElementById('m-costo').value||0;
  const eq=equipos.find(e=>e.id===id);
  if(!eq){toast('⚠️ Error','Selecciona un equipo','yellow');return;}
  if(!fecha){toast('⚠️ Error','Ingresa la fecha','yellow');return;}
  if(!desc){toast('⚠️ Error','Ingresa una descripción','yellow');return;}
  mantenimientos.push({id:nextMantId++,equipoId:eq.id,equipoNombre:eq.nombre,fecha,tipo,desc,tecnico:tecnico||currentUser?.nombre||'—',costo});
  if (tipo !== 'Correctivo') eq.horasAcum = 0;
  guardarDatos();
  ['m-tecnico','m-desc','m-costo'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  document.getElementById('m-equipo').value='';
  updateMantPreview(); updateBadges();
  toast('✔ Mantenimiento Guardado',`${eq.nombre} — ciclo reiniciado · ${tipo}`,'green');
}

// ══════════════════════════════════════════════
//  REPORTE
// ══════════════════════════════════════════════
function renderReporte() {
  const all=equipos.map(e=>({eq:e,c:calcEquipo(e)}));
  const ok=all.filter(x=>x.c.estado==='ok').length;
  const warn=all.filter(x=>x.c.estado==='warn').length;
  const crit=all.filter(x=>x.c.estado==='crit').length;
  const avgS=all.length?Math.round(all.reduce((a,x)=>a+x.c.saludPct,0)/all.length):0;
  const totalGasto=mantenimientos.reduce((s,m)=>s+(m.costo||0),0);
  const totalCorr=mantenimientos.filter(m=>m.tipo==='Correctivo').reduce((s,m)=>s+(m.costo||0),0);
  const totalPrev=mantenimientos.filter(m=>m.tipo==='Preventivo').reduce((s,m)=>s+(m.costo||0),0);
  const ahorro=totalCorr*(1-1/FACTOR_CORR);
  const avgProd=all.length?Math.round(all.reduce((s,x)=>{const p=prodCalc(x.eq);return s+p.pct;},0)/all.length):0;
  const critEq=all.filter(x=>x.c.estado==='crit').sort((a,b)=>a.c.saludPct-b.c.saludPct)[0];
  const allRecs=equipos.flatMap(eq=>iaAnalizar(eq).recs);
  const fecha=new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('reporte-contenido').innerHTML = `
    <div id="reporte-print">
      <div style="background:linear-gradient(135deg,var(--s2),var(--s3));border:1px solid var(--border2);border-radius:var(--r2);padding:28px 32px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
              <div style="width:44px;height:44px;background:linear-gradient(135deg,var(--blue),var(--cyan));border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 0 20px rgba(14,165,233,0.2)">⚙</div>
              <div><div style="font-size:1.4rem;font-weight:800;color:var(--blue2)">SIMPOE</div><div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:.09em">Sistema Inteligente de Mantenimiento Predictivo</div></div>
            </div>
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:3px">📄 Reporte Ejecutivo de Mantenimiento</div>
            <div style="font-size:.82rem;color:var(--text2)">Generado: ${fecha} · Usuario: ${currentUser?.nombre||'Sistema'} · ${equipos.length} equipos activos</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:2.2rem;font-weight:800;font-family:var(--mono);color:${sC2(avgS)}">${avgS}%</div>
            <div style="font-size:.72rem;color:var(--text3);text-transform:uppercase">Salud General de la Flota</div>
          </div>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">🧠 Análisis Ejecutivo Generado por IA</div>
        <div style="background:var(--s2);border:1px solid var(--border2);border-radius:var(--r2);padding:18px 22px;border-left:4px solid var(--blue)">
          <div style="font-size:.83rem;color:var(--text2);line-height:1.85">
            ${(()=>{
              const nCorr = mantenimientos.filter(m=>m.tipo==='Correctivo').length;
              const nPrev = mantenimientos.filter(m=>m.tipo==='Preventivo').length;
              const pctCorr = mantenimientos.length>0?Math.round(nCorr/mantenimientos.length*100):0;
              const severos = all.filter(x=>x.eq.factor>=1.5);
              const critList = all.filter(x=>x.c.estado==='crit');
              const warnList = all.filter(x=>x.c.estado==='warn');
              const topCrit = critList.sort((a,b)=>a.c.saludPct-b.c.saludPct)[0];
              const allFallas = fallas || [];
              const fallasPend = allFallas.filter(f=>f.estado!=='resuelta').length;

              let parrafos = [];

              // Párrafo 1 — estado general de la flota
              if (equipos.length === 0) {
                parrafos.push('No se han registrado equipos en el sistema. Para generar un análisis completo, registre los activos industriales de la organización.');
              } else if (critList.length === 0 && warnList.length === 0) {
                parrafos.push(`La flota industrial de <strong>${equipos.length} equipo${equipos.length>1?'s':''}</strong> se encuentra en condición operativa <strong>óptima</strong>, con un índice de salud promedio del <strong>${avgS}%</strong>. Todos los activos registrados operan dentro de los parámetros técnicos establecidos por sus respectivos fabricantes, lo que refleja una gestión de mantenimiento proactiva y eficiente.`);
              } else {
                parrafos.push(`El análisis de la flota de <strong>${equipos.length} equipo${equipos.length>1?'s':''}</strong> revela un índice de salud promedio del <strong>${avgS}%</strong>${critList.length>0?`, con <strong>${critList.length} activo${critList.length>1?'s':''} en estado crítico</strong> que requiere${critList.length>1?'n':''} intervención inmediata`:''}${warnList.length>0?` y <strong>${warnList.length} equipo${warnList.length>1?'s':''} con desgaste avanzado</strong> que demanda${warnList.length>1?'n':''} programación preventiva próxima`:''}. ${topCrit?`El activo de mayor urgencia es <strong>${topCrit.eq.nombre}</strong>, con solo <strong>${topCrit.c.saludPct}% de salud residual</strong> y <strong>${topCrit.c.vidaRestante}h de vida útil restante</strong> sobre un ciclo de ${topCrit.eq.horasRec}h.`:''}`);
              }

              // Párrafo 2 — patrón de mantenimiento
              if (mantenimientos.length >= 2) {
                if (pctCorr > 60) {
                  parrafos.push(`El historial de intervenciones evidencia un <strong>patrón reactivo dominante</strong>: el <strong>${pctCorr}% de los mantenimientos son correctivos</strong> (${nCorr} de ${mantenimientos.length} registros). Este comportamiento operativo implica que los equipos reciben atención primordialmente cuando ya han fallado, lo que eleva los costos de mantenimiento en promedio <strong>3.2 veces</strong> respecto a una estrategia preventiva equivalente. La implementación de un plan de mantenimiento preventivo estructurado se convierte en una prioridad estratégica para la organización.`);
                } else if (pctCorr > 30) {
                  parrafos.push(`El historial refleja una <strong>estrategia de mantenimiento mixta</strong>: ${nPrev} intervenciones preventivas (${100-pctCorr}%) frente a ${nCorr} correctivas (${pctCorr}%). Si bien existe un componente de planificación, existe margen significativo para incrementar la proporción preventiva y reducir los costos operativos asociados a fallas no programadas.`);
                } else if (mantenimientos.length > 0) {
                  parrafos.push(`El historial demuestra el compromiso de la organización con la <strong>gestión preventiva de activos</strong>: el <strong>${100-pctCorr}% de las intervenciones son planificadas</strong> (${nPrev} de ${mantenimientos.length}). Esta estrategia es consistente con estándares internacionales de mantenimiento industrial como ISO 55000 y maximiza la disponibilidad operativa de los equipos.`);
                }
              }

              // Párrafo 3 — equipos en uso intensivo
              if (severos.length > 0) {
                parrafos.push(`Se identifican <strong>${severos.length} equipo${severos.length>1?'s operando':' operando'} en régimen de uso intensivo</strong> con factores ≥1.5×: <strong>${severos.map(x=>x.eq.nombre).join(', ')}</strong>. El desgaste acelerado de estos activos implica que sus ciclos efectivos de mantenimiento son considerablemente menores a los recomendados por fabricante. Se recomienda revisar los intervalos de inspección y considerar lubricación o revisión de componentes con mayor frecuencia.`);
              }

              // Párrafo 4 — fallas reportadas
              if (fallasPend > 0) {
                parrafos.push(`El sistema registra <strong>${fallasPend} reporte${fallasPend>1?'s':''} de falla${fallasPend>1?'s':''} pendiente${fallasPend>1?'s':''} de resolución</strong>. La atención oportuna de estas incidencias es crítica para prevenir la escalada de fallas menores a problemas estructurales de mayor costo y complejidad.`);
              }

              // Párrafo 5 — cierre ejecutivo
              if (equipos.length > 0) {
                const accion = critList.length > 0
                  ? `La prioridad inmediata es atender los <strong>${critList.length} equipo${critList.length>1?'s críticos':' crítico'}</strong> antes de programar intervenciones preventivas en los activos con desgaste moderado.`
                  : warnList.length > 0
                  ? `Se recomienda programar las intervenciones preventivas de los <strong>${warnList.length} equipo${warnList.length>1?'s':''} en atención</strong> dentro de los próximos 15 días para mantener los índices operativos actuales.`
                  : `Mantener el plan de mantenimiento actual y realizar seguimiento periódico de los índices de salud para garantizar la continuidad operativa de la flota.`;
                parrafos.push(accion);
              }

              return parrafos.map((p,i)=>`<p style="margin:0 0 ${i<parrafos.length-1?'12px':'0'} 0">${p}</p>`).join('');
            })()}
          </div>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">📊 Resumen Ejecutivo</div>
        <div class="g4" style="margin-bottom:13px">
          <div class="stat-card blue"><div class="stat-icon">⚙️</div><div class="stat-value">${equipos.length}</div><div class="stat-label">Total Equipos</div></div>
          <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-value">${ok}</div><div class="stat-label">Estado OK</div></div>
          <div class="stat-card yellow"><div class="stat-icon">⚠️</div><div class="stat-value">${warn}</div><div class="stat-label">Atención</div></div>
          <div class="stat-card red"><div class="stat-icon">🔴</div><div class="stat-value">${crit}</div><div class="stat-label">Críticos</div></div>
        </div>
      </div>

      ${critEq?`<div class="report-section">
        <div class="report-section-title">🚨 Equipo Más Crítico</div>
        <div class="critical-banner">
          <div class="cb-label">REQUIERE INTERVENCIÓN INMEDIATA</div>
          <div class="cb-name">${critEq.eq.nombre}</div>
          <div class="cb-desc">${critEq.eq.tipo} · ${critEq.eq.ubicacion||'Sin ubicación'} · Salud: ${critEq.c.saludPct}% · Hrs Ajustadas: ${critEq.c.horasAjustadas}h / ${critEq.eq.horasRec}h recomendadas</div>
          <div class="cb-stats">
            <div class="cb-stat"><div class="cb-val" style="color:var(--red2)">${critEq.c.saludPct}%</div><div class="cb-lbl">Salud</div></div>
            <div class="cb-stat"><div class="cb-val" style="color:var(--red2)">${critEq.c.diasMantenimiento}d</div><div class="cb-lbl">Días p/Mant.</div></div>
            <div class="cb-stat"><div class="cb-val" style="color:var(--yellow2)">${critEq.eq.factor}x</div><div class="cb-lbl">Factor Uso</div></div>
          </div>
        </div>
      </div>`:''}

      <div class="report-section">
        <div class="report-section-title">💸 Análisis de Costos</div>
        <div class="g3" style="margin-bottom:13px">
          <div class="card"><div class="card-body" style="text-align:center"><div style="font-size:1.4rem;font-weight:800;font-family:var(--mono);color:var(--blue2)">${fmtCop(totalGasto)}</div><div class="cls-stat-sub">Gasto Total Histórico</div></div></div>
          <div class="card"><div class="card-body" style="text-align:center"><div style="font-size:1.4rem;font-weight:800;font-family:var(--mono);color:var(--green2)">${fmtCop(totalPrev)}</div><div class="cls-stat-sub">Costo Preventivo</div></div></div>
          <div class="card"><div class="card-body" style="text-align:center"><div style="font-size:1.4rem;font-weight:800;font-family:var(--mono);color:${ahorro>0?'var(--yellow2)':'var(--green2)'}">${fmtCop(ahorro>0?ahorro:0)}</div><div class="cls-stat-sub">Ahorro Potencial IA</div></div></div>
        </div>
        ${totalCorr>0?`<div class="formula-box"><span class="fb-icon">💡</span><div>Se gastaron <strong style="color:var(--red2)">${fmtCop(totalCorr)}</strong> en mantenimientos correctivos no planificados. Implementando un plan 100% preventivo se habrían ahorrado <strong style="color:var(--green2)">${fmtCop(ahorro)}</strong>.</div></div>`:'<div class="formula-box"><span class="fb-icon">✅</span><div>No se registran costos correctivos. Excelente gestión preventiva.</div></div>'}
      </div>

      <div class="report-section">
        <div class="report-section-title">📊 Productividad · Promedio Flota: ${avgProd}%</div>
        <div class="tw"><table><thead><tr><th>Equipo</th><th>Hrs Operativas</th><th>Hrs Disponibles</th><th>% Productividad</th><th>Estado Salud</th></tr></thead><tbody>
          ${all.map(({eq,c})=>{const p=prodCalc(eq);return `<tr><td><div class="eq-name">${eq.nombre}</div><div class="eq-type">${eq.tipo}</div></td><td style="font-family:var(--mono)">${eq.horasAcum}h</td><td style="font-family:var(--mono)">${p.horasDisp}h</td><td>${pb(p.pct)}</td><td>${badge(c.estado)}</td></tr>`;}).join('')}
        </tbody></table></div>
      </div>

      <div class="report-section">
        <div class="report-section-title">🧠 Recomendaciones IA (${allRecs.length} activas)</div>
        ${allRecs.slice(0,6).map(r=>`
          <div class="ai-rec ai-${r.nivel}" style="margin-bottom:7px">
            <div class="ai-rec-icon">${r.icono}</div>
            <div class="ai-rec-body">
              <div class="ai-rec-tag">${r.tag}</div>
              <div class="ai-rec-title">${r.titulo}</div>
              <div class="ai-rec-basis">📊 ${r.base}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="report-section">
        <div class="report-section-title">⚙️ Estado Detallado de Equipos</div>
        <div class="tw"><table><thead><tr><th>Equipo</th><th>Tipo</th><th>Hrs Rec.</th><th>Hrs Ajust.</th><th>Vida Rest.</th><th>Días p/Mant.</th><th>% Salud</th><th>Estado</th></tr></thead><tbody>
          ${all.map(({eq,c})=>`<tr><td><div class="eq-name">${eq.nombre}</div>${eq.serie?`<div style="font-size:.7rem;color:var(--text3);font-family:var(--mono)">S/N: ${eq.serie}</div>`:''}</td><td style="color:var(--text2);font-size:.8rem">${eq.tipo}</td><td style="font-family:var(--mono)">${eq.horasRec}h</td><td style="font-family:var(--mono);color:var(--yellow2)">${c.horasAjustadas}h</td><td style="font-family:var(--mono);color:var(--blue2)">${c.vidaRestante}h</td><td style="font-family:var(--mono);color:${dC(c.diasMantenimiento)}">${c.diasMantenimiento}d</td><td>${pb(c.saludPct)}</td><td>${badge(c.estado)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>

      <div class="report-section">
        <div class="report-section-title">⚠️ Problemas Detectados</div>
        ${(()=>{
          const problemas = [];
          all.forEach(({eq,c})=>{
            if(c.saludPct<=40) problemas.push({tipo:'crit',msg:`<strong>${eq.nombre}</strong> — Baja salud: ${c.saludPct}%. Vida restante: ${c.vidaRestante}h. Requiere mantenimiento urgente.`});
          });
          const costosAltos = equipos.filter(e=>{
            const corr=mantenimientos.filter(m=>m.equipoId===e.id&&m.tipo==='Correctivo').reduce((s,m)=>s+(m.costo||0),0);
            return corr>300000;
          });
          costosAltos.forEach(e=>{
            const corr=mantenimientos.filter(m=>m.equipoId===e.id&&m.tipo==='Correctivo').reduce((s,m)=>s+(m.costo||0),0);
            problemas.push({tipo:'warn',msg:`<strong>${e.nombre}</strong> — Alto costo correctivo: ${fmtCop(corr)}. Se recomienda plan preventivo.`});
          });
          all.filter(x=>x.eq.factor>=1.5).forEach(({eq,c})=>{
            problemas.push({tipo:'warn',msg:`<strong>${eq.nombre}</strong> — Uso excesivo: factor ${eq.factor}x. Desgaste acelerado. Horas ajustadas: ${c.horasAjustadas}h.`});
          });
          if(!problemas.length) return `<div style="padding:10px;font-size:.82rem;color:var(--green2)">✅ No se detectaron problemas críticos en la flota.</div>`;
          return problemas.map(p=>`
            <div style="background:${p.tipo==='crit'?'rgba(239,68,68,.07)':'rgba(245,158,11,.07)'};border-left:3px solid ${p.tipo==='crit'?'var(--red)':'var(--yellow)'};border-radius:var(--r);padding:9px 14px;margin-bottom:7px;font-size:.82rem;color:var(--text2)">
              ${p.tipo==='crit'?'🔴':'⚠️'} ${p.msg}
            </div>`).join('');
        })()}
      </div>

      <div class="report-section">
        <div class="report-section-title">🧠 Recomendaciones del Sistema</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${(()=>{
            const recomendaciones = [];
            const critsEq = all.filter(x=>x.c.estado==='crit');
            const warnsEq = all.filter(x=>x.c.estado==='warn');
            const severos = all.filter(x=>x.eq.factor>=1.5);
            const nCorrTotal = mantenimientos.filter(m=>m.tipo==='Correctivo').length;
            const nPrevTotal = mantenimientos.filter(m=>m.tipo==='Preventivo').length;
            if(critsEq.length>0) recomendaciones.push({icono:'🔴',texto:`Aplicar mantenimiento preventivo inmediato en ${critsEq.map(x=>x.eq.nombre).join(', ')}. La intervención a tiempo evita fallas totales y costos correctivos elevados.`});
            if(warnsEq.length>0) recomendaciones.push({icono:'⚠️',texto:`Programar mantenimiento preventivo en los próximos días para: ${warnsEq.map(x=>x.eq.nombre).join(', ')}. Salud entre 40–70%.`});
            if(severos.length>0) recomendaciones.push({icono:'⚡',texto:`Reducir uso o aumentar frecuencia de mantenimiento en ${severos.map(x=>x.eq.nombre).join(', ')} (factor ≥1.5x). Monitorear señales de desgaste acelerado.`});
            if(nCorrTotal>nPrevTotal) recomendaciones.push({icono:'💡',texto:`Implementar un plan de mantenimiento preventivo estructurado. El ${Math.round(nCorrTotal/(nCorrTotal+nPrevTotal)*100)}% de las intervenciones históricas son correctivas, lo que eleva innecesariamente los costos operativos.`});
            recomendaciones.push({icono:'📊',texto:`Monitorear regularmente los equipos con alto desgaste operativo a través del módulo de IA del sistema SIMPOE para tomar decisiones basadas en datos.`});
            return recomendaciones.map(r=>`
              <div style="background:rgba(14,165,233,.06);border-left:3px solid var(--blue);border-radius:var(--r);padding:9px 14px;font-size:.82rem;color:var(--text2)">
                ${r.icono} ${r.texto}
              </div>`).join('');
          })()}
        </div>
      </div>

      <div style="background:rgba(14,165,233,.06);border:1px solid rgba(14,165,233,.15);border-radius:var(--r);padding:12px 16px;margin-bottom:14px;font-size:.8rem;color:var(--text2)">
        🔗 <strong style="color:var(--blue2)">Integración de módulos:</strong> Los resultados de este reporte integran datos de cálculo de vida útil, historial de mantenimiento, costos operativos y productividad, permitiendo una toma de decisiones basada en múltiples variables del sistema SIMPOE.
      </div>

      <div style="text-align:center;padding:16px;color:var(--text3);font-size:.78rem;border-top:1px solid var(--border);margin-top:8px">
        Generado por SIMPOE · Sistema Inteligente de Mantenimiento y Productividad Industrial<br>
        ${fecha} · ${equipos.length} equipos registrados · ${mantenimientos.length} intervenciones históricas
      </div>
    </div>`;
}

function imprimirReporte() {
  renderReporte();
  setTimeout(()=>window.print(),200);
}

// ══════════════════════════════════════════════
//  DETALLE EQUIPO
// ══════════════════════════════════════════════
function abrirDetalle(id) {
  const eq   = equipos.find(e=>e.id===id);
  if(!eq) return;
  const c    = calcEquipo(eq);
  const hist = mantenimientos.filter(m=>m.equipoId===id);
  const ia   = iaAnalizar(eq);
  const main = ia.recs[0];
  const r=45, circ=2*Math.PI*r, dash=(c.saludPct/100)*circ;

  // ── Diagnóstico completo narrativo ────────────────────
  const nCorr   = hist.filter(m=>m.tipo==='Correctivo').length;
  const nPrev   = hist.filter(m=>m.tipo==='Preventivo').length;
  const pctCorr = hist.length>0 ? Math.round(nCorr/hist.length*100) : 0;
  const prod    = prodCalc(eq);

  const diagnostico = (() => {
    const puntos = [];
    // Salud
    if (c.saludPct >= 70) puntos.push(`opera con <strong>${c.saludPct}% de salud</strong>, dentro del rango óptimo`);
    else if (c.saludPct >= 40) puntos.push(`presenta <strong>${c.saludPct}% de salud</strong>, requiriendo atención en los próximos días`);
    else puntos.push(`registra un <strong>nivel de salud crítico del ${c.saludPct}%</strong>, necesitando intervención inmediata`);
    // Factor
    if (eq.factor >= 1.5) puntos.push(`opera bajo <strong>condiciones de uso intensivo</strong> (factor ${eq.factor}×), lo que acelera el desgaste`);
    else if (eq.factor > 1.0) puntos.push(`mantiene un <strong>factor de uso moderado de ${eq.factor}×</strong>`);
    // Historial
    if (hist.length === 0) puntos.push(`aún <strong>no cuenta con historial de mantenimiento</strong> registrado en el sistema`);
    else if (pctCorr > 60) puntos.push(`su historial refleja un <strong>patrón reactivo</strong> con ${pctCorr}% de intervenciones correctivas`);
    else if (pctCorr <= 30) puntos.push(`mantiene un <strong>buen historial preventivo</strong> (${100-pctCorr}% de intervenciones planificadas)`);
    // Productividad
    if (prod.pct < 40 && eq.horasAcum > 50) puntos.push(`registra <strong>baja productividad del ${prod.pct}%</strong> respecto a su capacidad disponible`);

    return `El análisis indica que el equipo <strong>${eq.nombre}</strong> ${puntos.join(', ')}. ${
      c.diasMantenimiento <= 0
        ? '⚡ El ciclo de mantenimiento está <strong>vencido</strong>.'
        : c.diasMantenimiento <= 7
        ? `⚠️ El próximo mantenimiento debe realizarse en <strong>${c.diasMantenimiento} días</strong>.`
        : `El próximo mantenimiento está programado en <strong>${c.diasMantenimiento} días</strong>.`
    }`;
  })();

  document.getElementById('detalle-title').textContent = `⚙️ ${eq.nombre}`;
  document.getElementById('detalle-body').innerHTML = `
    <!-- Header con ring -->
    <div style="display:flex;gap:16px;margin-bottom:14px">
      <div style="position:relative;width:96px;height:96px;flex-shrink:0">
        <svg width="96" height="96" viewBox="0 0 100 100" style="transform:rotate(-90deg)">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--border)" stroke-width="9"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${sC(c.saludPct)}" stroke-width="9"
            stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
          <span style="font-size:1.3rem;font-weight:800;font-family:var(--mono);color:${sC2(c.saludPct)}">${c.saludPct}%</span>
          <span style="font-size:.58rem;color:var(--text3);text-transform:uppercase">Salud</span>
        </div>
      </div>
      <div style="flex:1">
        <div style="font-size:1rem;font-weight:800;margin-bottom:2px">${eq.nombre}</div>
        <div style="font-size:.78rem;color:var(--text3);margin-bottom:6px">${eq.tipo}${eq.fabricante?' · '+eq.fabricante:''}${eq.ubicacion?' · '+eq.ubicacion:''}</div>
        ${badge(c.estado)}
        <div style="margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.78rem">
          <div>📅 Días p/Mant: <b style="color:${dC(c.diasMantenimiento)}">${c.diasMantenimiento}d</b></div>
          <div>⏱ Vida Rest: <b style="color:var(--blue2)">${c.vidaRestante}h</b></div>
          <div>⚡ Factor: <b>${eq.factor}×</b></div>
          <div>🕐 Hrs/Día: <b>${eq.horasDia}h</b></div>
        </div>
      </div>
    </div>

    <!-- Diagnóstico IA narrativo -->
    <div style="background:var(--bg);border-radius:var(--r);padding:11px 13px;margin-bottom:11px;border-left:3px solid ${main.nivel==='ok'?'var(--green)':main.nivel==='warn'?'var(--yellow)':main.nivel==='info'?'var(--blue)':'var(--red)'}">
      <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--blue2);margin-bottom:5px">🧠 Diagnóstico IA</div>
      <div style="font-size:.81rem;color:var(--text2);line-height:1.6">${diagnostico}</div>
    </div>

    <!-- Datos técnicos -->
    <div class="divider"></div>
    <div class="rg-2" style="margin-bottom:11px;font-size:.79rem">
      <div class="kv-row" style="border:none;padding:3px 0"><span class="kv-key">Hrs Acumuladas</span><span class="kv-val" style="color:var(--blue2)">${eq.horasAcum}h</span></div>
      <div class="kv-row" style="border:none;padding:3px 0"><span class="kv-key">Hrs Ajustadas</span><span class="kv-val" style="color:var(--yellow2)">${c.horasAjustadas}h</span></div>
      <div class="kv-row" style="border:none;padding:3px 0"><span class="kv-key">Hrs Recomendadas</span><span class="kv-val">${eq.horasRec}h</span></div>
      <div class="kv-row" style="border:none;padding:3px 0"><span class="kv-key">% Ciclo Usado</span><span class="kv-val" style="color:${sC2(100-c.usoPct)}">${c.usoPct}%</span></div>
      ${eq.serie?`<div class="kv-row" style="border:none;padding:3px 0"><span class="kv-key">N° Serie</span><span class="kv-val" style="font-family:var(--mono)">${eq.serie}</span></div>`:''}
      ${eq.criticidad?`<div class="kv-row" style="border:none;padding:3px 0"><span class="kv-key">Criticidad</span><span class="kv-val">${eq.criticidad==='alta'?'🔴 Alta':eq.criticidad==='media'?'🟡 Media':'🟢 Baja'}</span></div>`:''}
    ${eq.extra && Object.keys(eq.extra).length ? `
      <div style="grid-column:1/-1;margin-top:6px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:var(--blue2);margin-bottom:6px;font-weight:700">${SECTOR_CONFIG[getTipoEmpresa()]?.icono||''} Datos del Sector</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          ${Object.entries(eq.extra).filter(([k,v])=>v).map(([k,v])=>`
            <div class="kv-row" style="border:none;padding:2px 0;font-size:.77rem">
              <span class="kv-key" style="text-transform:capitalize">${k.replace(/-/g,' ')}</span>
              <span class="kv-val">${v}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <!-- Historial -->
    <div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">
      Historial (${hist.length} registro${hist.length!==1?'s':''})
      ${hist.length>0?`<span style="font-weight:400;font-size:.7rem;color:var(--text3)"> · ${nPrev} prev / ${nCorr} corr</span>`:''}
    </div>
    ${hist.length
      ? hist.slice(0,3).map(m=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(44,30,18,.6);font-size:.78rem">
          <div style="display:flex;align-items:center;gap:6px;min-width:0">
            ${badge(m.tipo==='Preventivo'?'ok':m.tipo==='Correctivo'?'crit':'info')}
            <span style="color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.desc.slice(0,40)}${m.desc.length>40?'…':''}</span>
          </div>
          <span style="color:var(--text3);font-family:var(--mono);font-size:.71rem;flex-shrink:0;margin-left:8px">${fmtDate(m.fecha)}</span>
        </div>`).join('')
      : `<div style="color:var(--text3);font-size:.8rem;text-align:center;padding:12px">Sin historial de mantenimientos registrado</div>`}`;

  document.getElementById('detalle-btn-mant').onclick = ()=>{ closeModal('modal-detalle'); irAMant(id); };
  document.getElementById('detalle-btn-graf').onclick = ()=>{ closeModal('modal-detalle'); irAGrafica(id); };
  document.getElementById('detalle-btn-qr').onclick   = ()=>{ closeModal('modal-detalle'); mostrarQR(id); };
  openModal('modal-detalle');
}

function irAGrafica(id) {
  goView('graficas',null);
}
function irAMant(id) {
  goView('mantenimiento',document.getElementById('nav-mantenimiento'));
  setTimeout(()=>{ const s=document.getElementById('m-equipo'); if(s){s.value=id;updateMantPreview();} },80);
}

// ══════════════════════════════════════════════
//  GUARDAR EQUIPO
// ══════════════════════════════════════════════
function abrirModalEquipo() {
  // Reset form
  ['eq-nombre','eq-fabricante','eq-modelo','eq-serie','eq-horas-rec','eq-horas-dia',
   'eq-factor','eq-horas-acum','eq-ubicacion','eq-notas','eq-cal-frecuencia','eq-cal-ultima','eq-vida-util']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const crit = document.getElementById('eq-criticidad');
  if(crit) crit.value = 'media';
  const cal = document.getElementById('eq-requiere-cal');
  if(cal) cal.value = 'no';
  const fw1 = document.getElementById('eq-cal-frecuencia-wrap');
  const fw2 = document.getElementById('eq-cal-ultima-wrap');
  if(fw1) fw1.style.display='none';
  if(fw2) fw2.style.display='none';
  const cbs = document.querySelectorAll('#eq-condiciones input[type=checkbox]');
  cbs.forEach(cb=>{ cb.checked = cb.value==='normal'; });
  const docs = document.getElementById('eq-docs-lista');
  if(docs) docs.innerHTML='';
  window._eqDocsTemp=[];
  // Render sector-specific extra fields
  renderCamposExtra();
  openModal('modal-equipo');
}

function guardarEquipo() {
  const nombre   = document.getElementById('eq-nombre').value.trim();
  const tipo     = document.getElementById('eq-tipo').value;
  const serie    = document.getElementById('eq-serie').value.trim();
  const modelo   = document.getElementById('eq-modelo').value.trim();
  const horasRec = +document.getElementById('eq-horas-rec').value;
  const horasDia = +document.getElementById('eq-horas-dia').value;
  const factor   = +document.getElementById('eq-factor').value;
  const horasAcum= +document.getElementById('eq-horas-acum').value||0;
  const ubicacion= document.getElementById('eq-ubicacion').value.trim();
  const notas    = document.getElementById('eq-notas').value.trim();

  // Validate required fields visually
  limpiarErrores(['eq-nombre','eq-horas-rec','eq-horas-dia','eq-factor']);
  let valid = true;
  if(!nombre)        { validarCampo('eq-nombre','El nombre del equipo es obligatorio');         valid=false; }
  if(!horasRec||horasRec<1) { validarCampo('eq-horas-rec','Ingresa un valor mayor a 0'); valid=false; }
  if(!horasDia||horasDia<0.5){ validarCampo('eq-horas-dia','Mínimo 0.5 horas por día');  valid=false; }
  if(!factor||factor<0.1)    { validarCampo('eq-factor','Factor mínimo: 0.1');            valid=false; }
  if(!valid) { toast('⚠️ Formulario incompleto','Corrige los campos marcados en rojo','yellow'); return; }

  const newId = nextEqId++;
  const codigo = `SIMPOE-${String(newId).padStart(4,'0')}`;

  // Recoger nuevos campos
  const fabricante = document.getElementById('eq-fabricante').value.trim();
  const vidaUtil   = +document.getElementById('eq-vida-util').value||0;
  const criticidad = document.getElementById('eq-criticidad').value;
  const calReq     = document.getElementById('eq-requiere-cal').value;
  const calFrec    = +document.getElementById('eq-cal-frecuencia').value||0;
  const calUltima  = document.getElementById('eq-cal-ultima').value;
  // Condiciones de operación (multiselect checkboxes)
  const condCbs = document.querySelectorAll('#eq-condiciones input[type=checkbox]:checked');
  const condiciones = Array.from(condCbs).map(cb=>cb.value);
  // Documentos adjuntos (stored as file names/base64)
  const docs = window._eqDocsTemp || [];

  // Read sector-specific extra fields
  const extra = leerCamposExtra();

  equipos.push({
    id:newId, nombre, tipo, serie, extra,
    modelo: document.getElementById('eq-modelo')?.value.trim()||'',
    fabricante, vidaUtil, criticidad, condiciones,
    calReq, calFrec, calUltima, docs,
    codigo, horasRec, horasDia, factor, horasAcum, ubicacion, notas
  });

  // Clear form
  ['eq-nombre','eq-fabricante','eq-modelo','eq-serie','eq-horas-rec','eq-horas-dia',
   'eq-factor','eq-horas-acum','eq-ubicacion','eq-notas','eq-cal-frecuencia','eq-cal-ultima','eq-vida-util']
    .forEach(i=>{ const el=document.getElementById(i); if(el) el.value=''; });
  document.getElementById('eq-criticidad').value='media';
  document.getElementById('eq-requiere-cal').value='no';
  document.getElementById('eq-cal-frecuencia-wrap').style.display='none';
  document.getElementById('eq-cal-ultima-wrap').style.display='none';
  document.querySelectorAll('#eq-condiciones input[type=checkbox]').forEach(cb=>{ cb.checked = cb.value==='normal'; });
  document.getElementById('eq-docs-lista').innerHTML='';
  window._eqDocsTemp=[];
  document.getElementById('eq-preview').style.display='none';
  closeModal('modal-equipo');
  guardarDatos();
  renderDashboard(); updateBadges();
  toast('✅ Equipo Registrado',`${nombre} · Código ${codigo}. Ver etiqueta QR en detalle.`,'green');
  setTimeout(()=>mostrarQR(newId), 700);
}

function confirmarEliminar(id) {
  const eq=equipos.find(e=>e.id===id);
  if(!eq)return;
  if(!confirm(`¿Eliminar "${eq.nombre}"?\nEsta acción no se puede deshacer.`))return;
  equipos=equipos.filter(e=>e.id!==id);
  mantenimientos=mantenimientos.filter(m=>m.equipoId!==id);
  guardarDatos();
  renderDashboard(); renderEquipos(); updateBadges();
  toast('🗑️ Eliminado',eq.nombre,'red');
}

// Preview equipo modal
['eq-horas-rec','eq-horas-dia','eq-factor','eq-horas-acum'].forEach(id=>{
  setTimeout(()=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('input',()=>{
      const hr=+document.getElementById('eq-horas-rec').value;
      const hd=+document.getElementById('eq-horas-dia').value;
      const fc=+document.getElementById('eq-factor').value;
      const ha=+document.getElementById('eq-horas-acum').value||0;
      const pr=document.getElementById('eq-preview');
      if(hr&&hd&&fc){
        const eq={horasRec:hr,horasDia:hd,factor:fc,horasAcum:ha};
        const c=calcEquipo(eq);
        pr.style.display='block';
        pr.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div style="font-weight:800;color:${sC2(c.saludPct)};font-family:var(--mono)">${c.saludPct}%</div><div style="font-size:.68rem;color:var(--text3)">Salud inicial</div></div>
          <div><div style="font-weight:800;color:${dC(c.diasMantenimiento)};font-family:var(--mono)">${c.diasMantenimiento}d</div><div style="font-size:.68rem;color:var(--text3)">Días p/Mant.</div></div>
          <div><div style="font-weight:800;color:var(--blue2);font-family:var(--mono)">${c.vidaRestante}h</div><div style="font-size:.68rem;color:var(--text3)">Vida Restante</div></div>
        </div>`;
      }
    });
  },0);
});

// ══════════════════════════════════════════════
//  MODAL + TOAST
// ══════════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{ if(e.target===ov) ov.classList.remove('open'); }));

function toast(title,sub='',type='blue') {
  const icons={blue:'ℹ️',green:'✅',red:'❌',yellow:'⚠️'};
  const colors={blue:'var(--blue)',green:'var(--green)',red:'var(--red)',yellow:'var(--yellow)'};
  const wrap=document.getElementById('toast-wrap');
  const el=document.createElement('div');
  el.className='toast';
  el.style.borderLeft=`3px solid ${colors[type]||colors.blue}`;
  el.innerHTML=`<div class="toast-icon">${icons[type]||'ℹ️'}</div><div><div class="toast-title" style="color:${colors[type]||colors.blue}">${title}</div>${sub?`<div class="toast-sub">${sub}</div>`:''}</div>`;
  wrap.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),300); },3800);
}

// ══════════════════════════════════════════════
//  PRINT STYLES
// ══════════════════════════════════════════════
const printStyle=document.createElement('style');
printStyle.textContent=`@media print{
  body{overflow-x:hidden;max-width:100vw;background:#fff!important;color:#000!important;overflow:auto!important;}
  #login-screen,.topbar,.sidebar,.toast-wrap,button,.btn{display:none!important;}
  .main{overflow:visible!important;}
  .view{display:none!important;}
  #view-reporte{display:block!important;padding:0!important;}
  #reporte-print{background:#fff;color:#000;}
  .card,.stat-card{border:1px solid #ccc!important;background:#f9f9f9!important;}
  .stat-value,.kv-val{color:#000!important;}
  .stat-label,.kv-key,.eq-type{color:#555!important;}
}`;
document.head.appendChild(printStyle);

// ══════════════════════════════════════════════
//  QR — ETIQUETA DE EQUIPO
// ══════════════════════════════════════════════
let qrActualId = null;

function mostrarQR(id) {
  const eq = equipos.find(e=>e.id===id);
  if (!eq) return;
  qrActualId = id;
  const codigo = eq.codigo || `SIMPOE-${String(eq.id).padStart(4,'0')}`;
  const qrData = JSON.stringify({
    sistema: 'SIMPOE',
    codigo,
    nombre: eq.nombre,
    tipo: eq.tipo,
    serie: eq.serie || '—',
    ubicacion: eq.ubicacion || '—'
  });

  document.getElementById('modal-qr-body').innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:20px;display:inline-block;margin-bottom:14px">
      <div id="qr-canvas" style="display:flex;align-items:center;justify-content:center"></div>
    </div>
    <div style="background:var(--s3);border-radius:var(--r);padding:14px;text-align:left;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:1rem;font-weight:800;color:var(--blue2)">SIMPOE</div>
        <div style="font-size:.7rem;color:var(--text3);font-family:var(--mono)">${codigo}</div>
      </div>
      <div style="font-size:.9rem;font-weight:700;margin-bottom:3px">${eq.nombre}</div>
      <div style="font-size:.78rem;color:var(--text2)">${eq.tipo}${eq.ubicacion ? ' · ' + eq.ubicacion : ''}</div>
      ${eq.serie ? `<div style="font-size:.75rem;color:var(--text3);margin-top:4px;font-family:var(--mono)">S/N: ${eq.serie}</div>` : ''}
      ${eq.modelo ? `<div style="font-size:.75rem;color:var(--text3)">Modelo: ${eq.modelo}</div>` : ''}
    </div>
    <div style="font-size:.76rem;color:var(--text3)">Escanea para identificar el equipo · Imprime y pégalo directamente en la máquina.</div>`;

  openModal('modal-qr');

  setTimeout(() => {
    const canvas = document.getElementById('qr-canvas');
    if (canvas && typeof QRCode !== 'undefined') {
      canvas.innerHTML = '';
      new QRCode(canvas, {
        text: qrData,
        width: 160,
        height: 160,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else if (canvas) {
      canvas.innerHTML = `<div style="width:160px;height:160px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px;color:#333;font-size:.8rem;text-align:center;padding:10px">QR: ${codigo}</div>`;
    }
  }, 100);
}

function imprimirQR() {
  const eq = equipos.find(e=>e.id===qrActualId);
  if (!eq) return;
  const codigo = eq.codigo || `SIMPOE-${String(eq.id).padStart(4,'0')}`;
  const win = window.open('', '_blank');
  const qrCanvas = document.querySelector('#qr-canvas canvas, #qr-canvas img');
  const qrSrc = qrCanvas ? (qrCanvas.toDataURL ? qrCanvas.toDataURL() : qrCanvas.src) : '';
  win.document.write(`<!DOCTYPE html><html><head><title>Etiqueta SIMPOE - ${eq.nombre}</title>
  <style>
    body{overflow-x:hidden;max-width:100vw;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;}
    .label{border:2px solid #000;border-radius:8px;padding:16px;width:280px;text-align:center;}
    .brand{font-size:1.1rem;font-weight:900;letter-spacing:.1em;color:#b85e0a;margin-bottom:6px;}
    .codigo{font-size:.7rem;font-family:monospace;color:#666;margin-bottom:10px;}
    .qr-area{margin:8px auto;display:flex;justify-content:center;}
    .nombre{font-size:.95rem;font-weight:700;margin-top:10px;}
    .meta{font-size:.72rem;color:#555;margin-top:4px;}
    .serie{font-size:.68rem;font-family:monospace;color:#888;margin-top:3px;}
  </style></head><body>
  <div class="label">
    <div class="brand brand-logo">SIMPOE</div>
    <div class="codigo">${codigo}</div>
    <div class="qr-area">${qrSrc ? `<img src="${qrSrc}" width="140" height="140">` : `<div style="width:140px;height:140px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#666">QR: ${codigo}</div>`}</div>
    <div class="nombre">${eq.nombre}</div>
    <div class="meta">${eq.tipo}${eq.ubicacion?' · '+eq.ubicacion:''}</div>
    ${eq.serie?`<div class="serie">S/N: ${eq.serie}</div>`:''}
    ${eq.modelo?`<div class="serie">${eq.modelo}</div>`:''}
  </div>
  <script>window.onload=()=>window.print();<\/script>
  </body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════
//  MENSAJES INTELIGENTES DEL SISTEMA
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  GESTIÓN DE ACTIVOS EMPRESARIALES
// ══════════════════════════════════════════════




// Genera inventario demo realista para empresas tipo Gestión de Activos

function abrirModalActivo(editId = null) {
  activoEditandoId = editId;
  const campos = ['act-nombre','act-marca','act-modelo','act-serial','act-sede','act-area',
                  'act-oficina','act-responsable','act-proveedor','act-obs'];
  const act = editId ? activosEmpresariales.find(a=>a.id===editId) : null;
  document.getElementById('modal-activo-titulo').textContent = editId ? '✏️ Editar Activo' : '🗂️ Registrar Activo';
  campos.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const key = id.replace('act-','');
    el.value = act ? (act[key]||'') : '';
  });
  if (act) {
    document.getElementById('act-cat').value         = act.categoria    || '';
    document.getElementById('act-estado').value      = act.estado       || 'operativo';
    document.getElementById('act-fecha-compra').value= act.fechaCompra  || '';
    document.getElementById('act-garantia').value    = act.garantia     || '';
    document.getElementById('act-costo').value       = act.costo        || '';
    document.getElementById('act-obs').value         = act.obs          || '';
  } else {
    document.getElementById('act-cat').value    = '';
    document.getElementById('act-estado').value  = 'operativo';
  }
  document.getElementById('act-modal-error').style.display = 'none';
  openModal('modal-activo');
}

// ── Guardar activo ────────────────────────────────────────
function guardarActivo() {
  const nombre      = document.getElementById('act-nombre').value.trim();
  const categoria   = document.getElementById('act-cat').value;
  const marca       = document.getElementById('act-marca').value.trim();
  const modelo      = document.getElementById('act-modelo').value.trim();
  const serial      = document.getElementById('act-serial').value.trim();
  const estado      = document.getElementById('act-estado').value;
  const sede        = document.getElementById('act-sede').value.trim();
  const area        = document.getElementById('act-area').value.trim();
  const oficina     = document.getElementById('act-oficina').value.trim();
  const responsable = document.getElementById('act-responsable').value.trim();
  const fechaCompra = document.getElementById('act-fecha-compra').value;
  const garantia    = document.getElementById('act-garantia').value;
  const proveedor   = document.getElementById('act-proveedor').value.trim();
  const costo       = +document.getElementById('act-costo').value || 0;
  const obs         = document.getElementById('act-obs').value.trim();
  const errEl       = document.getElementById('act-modal-error');
  if (!nombre)    { errEl.textContent='⚠️ Ingresa el nombre del activo.';    errEl.style.display='block'; return; }
  if (!categoria) { errEl.textContent='⚠️ Selecciona la categoría.';          errEl.style.display='block'; return; }
  if (!sede)      { errEl.textContent='⚠️ Ingresa la sede del activo.';       errEl.style.display='block'; return; }
  errEl.style.display = 'none';
  const hoy = new Date().toISOString().slice(0,10);
  if (activoEditandoId) {
    const act = activosEmpresariales.find(a=>a.id===activoEditandoId);
    if (act) {
      // Log the change
      if (!act.historial) act.historial = [];
      act.historial.push({fecha:hoy,tipo:'edicion',desc:`Activo editado. Estado: ${estado}`,usuario:currentUser?.nombre||'Sistema'});
      Object.assign(act, {nombre,categoria,marca,modelo,serial,estado,sede,area,oficina,responsable,fechaCompra,garantia,proveedor,costo,obs,updatedAt:hoy});
    }
    guardarActivos(); closeModal('modal-activo'); renderActivos(); updateBadges();
    toast('✏️ Activo Actualizado', nombre, 'green');
  } else {
    const newId  = nextActivoId++;
    const codigo = `ACT-${String(newId).padStart(5,'0')}`;
    activosEmpresariales.push({
      id:newId, codigo, nombre, categoria, marca, modelo, serial, estado,
      sede, area, oficina, responsable, fechaCompra, garantia, proveedor, costo, obs,
      movimientos:[], historial:[{fecha:hoy,tipo:'registro',desc:'Activo registrado en el sistema',usuario:currentUser?.nombre||'Sistema'}],
      createdAt:hoy
    });
    guardarActivos(); closeModal('modal-activo'); renderActivos(); updateBadges();
    toast('✅ Activo Registrado', `${nombre} · ${codigo}`, 'green');
    setTimeout(()=>mostrarQRActivo(newId), 700);
  }
}

// ── Render lista activos ──────────────────────────────────
function renderActivos() {
  const q    = (document.getElementById('act-search')||{}).value||'';
  const cat  = (document.getElementById('act-filtro-cat')||{}).value||'';
  const est  = (document.getElementById('act-filtro-estado')||{}).value||'';
  const sede = (document.getElementById('act-filtro-sede')||{}).value||'';

  // Populate sede filter
  const sedeSel = document.getElementById('act-filtro-sede');
  if (sedeSel && sedeSel.options.length <= 1) {
    const sedes = [...new Set(activosEmpresariales.map(a=>a.sede).filter(Boolean))];
    sedes.forEach(s=>{ const o=document.createElement('option'); o.textContent=s; sedeSel.appendChild(o); });
  }

  // Stats dashboard
  const hoy    = new Date();
  const total  = activosEmpresariales.length;
  const operativos = activosEmpresariales.filter(a=>a.estado==='operativo').length;
  const dañados    = activosEmpresariales.filter(a=>a.estado==='dañado'||a.estado==='baja'||a.estado==='mantenimiento').length;
  const sinResp    = activosEmpresariales.filter(a=>!a.responsable).length;
  const valorTotal = activosEmpresariales.reduce((s,a)=>s+(a.costo||0),0);
  const garantProx = activosEmpresariales.filter(a=>{
    if(!a.garantia||a.estado==='baja') return false;
    const d=Math.round((new Date(a.garantia)-hoy)/864e5);
    return d>=0&&d<=30;
  }).length;

  const statsEl = document.getElementById('act-stats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-card blue"><div class="stat-icon">🗂️</div><div class="stat-value">${total}</div><div class="stat-label">Total Activos</div><div class="stat-sub">${fmtCop(valorTotal)} en inventario</div></div>
    <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-value">${operativos}</div><div class="stat-label">Operativos</div><div class="stat-sub">${total?Math.round(operativos/total*100):0}% disponibles</div></div>
    <div class="stat-card yellow"><div class="stat-icon">⚠️</div><div class="stat-value">${dañados}</div><div class="stat-label">Dañados / Baja</div><div class="stat-sub">${garantProx} garantías próx. a vencer</div></div>
    <div class="stat-card red"><div class="stat-icon">👤</div><div class="stat-value">${sinResp}</div><div class="stat-label">Sin Responsable</div><div class="stat-sub">Sin asignación</div></div>`;

  // IA Panel
  renderIAActivos();

  // Filter
  let data = activosEmpresariales.filter(a => {
    const matchQ  = !q || [a.nombre,a.serial,a.responsable,a.codigo,a.marca,a.modelo,a.sede,a.area]
      .some(f=>(f||'').toLowerCase().includes(q.toLowerCase()));
    const matchCat= !cat || a.categoria===cat;
    const matchEst= !est || a.estado===est;
    const matchSed= !sede || a.sede===sede;
    return matchQ&&matchCat&&matchEst&&matchSed;
  });

  const listEl = document.getElementById('act-list');
  if (!listEl) return;
  if (!data.length) {
    listEl.innerHTML = `<div class="search-empty"><div class="search-empty-icon">🗂️</div>
      <div class="search-empty-title">${total===0?'No hay activos registrados aún':'Sin resultados para este filtro'}</div>
      <div class="search-empty-sub">${total===0?'Registra el primer activo con el botón "Registrar Activo"':'Prueba cambiando los filtros'}</div></div>`;
    return;
  }

  const estadoBadge = {
    operativo:    '<span class="badge b-ok">✅ Operativo</span>',
    dañado:       '<span class="badge b-warn">⚠️ Dañado</span>',
    mantenimiento:'<span class="badge b-info">🔧 Mantenimiento</span>',
    baja:         '<span class="badge b-crit">🔴 Dado de Baja</span>',
  };
  // Garantía warning
  const garantWarn = (a) => {
    if(!a.garantia||a.estado==='baja') return '';
    const d=Math.round((new Date(a.garantia)-hoy)/864e5);
    if(d<0)  return `<div style="font-size:.68rem;color:var(--red2)">🔴 Garantía vencida</div>`;
    if(d<=30)return `<div style="font-size:.68rem;color:var(--yellow2)">⚠️ Garantía vence en ${d}d</div>`;
    return '';
  };

  listEl.innerHTML = `<div class="tw"><table><thead><tr>
    <th>Código</th><th>Activo</th><th>Categoría</th><th>Estado</th>
    <th>Ubicación</th><th>Responsable</th><th>Garantía / Costo</th><th></th>
  </tr></thead><tbody>
  ${data.map(a=>`<tr>
    <td style="font-family:var(--mono);font-size:.74rem;color:var(--blue2)">${a.codigo}</td>
    <td>
      <div style="font-weight:700;font-size:.85rem">${a.nombre}</div>
      <div style="font-size:.72rem;color:var(--text3)">${[a.marca,a.modelo].filter(Boolean).join(' ')}</div>
      ${a.serial?`<div style="font-size:.67rem;color:var(--text3);font-family:var(--mono)">S/N: ${a.serial}</div>`:''}
    </td>
    <td style="font-size:.82rem">${a.categoria||'—'}</td>
    <td>${estadoBadge[a.estado]||estadoBadge.operativo}</td>
    <td style="font-size:.8rem;color:var(--text2)">
      <div>${a.sede||'—'}</div>
      ${a.area?`<div style="font-size:.72rem;color:var(--text3)">${a.area}${a.oficina?' · '+a.oficina:''}</div>`:''}
    </td>
    <td style="font-size:.82rem;color:${a.responsable?'var(--text2)':'var(--red2)'}">${a.responsable||'⚠️ Sin asignar'}</td>
    <td>
      ${garantWarn(a)}
      <div style="font-family:var(--mono);font-size:.79rem;color:var(--green2)">${a.costo?fmtCop(a.costo):'—'}</div>
      ${a.movimientos?.length?`<div style="font-size:.67rem;color:var(--text3)">${a.movimientos.length} mov.</div>`:''}
    </td>
    <td style="white-space:nowrap;padding:4px 6px">
      <button class="btn btn-ghost btn-xs" onclick="verActivo(${a.id})" title="Ver hoja de vida">🔍</button>
      <button class="btn btn-ghost btn-xs" onclick="abrirModalActivo(${a.id})" title="Editar">✏️</button>
      <button class="btn btn-warn btn-xs" onclick="abrirMoverActivo(${a.id})" title="Mover/Transferir">🔄</button>
      <button class="btn btn-ghost btn-xs" onclick="mostrarQRActivo(${a.id})" title="Ver QR">📱</button>
      ${a.estado!=='baja'?`<button class="btn btn-danger btn-xs" onclick="abrirBajaActivo(${a.id})" title="Dar de baja">🔴</button>`:''}
      <button class="btn btn-danger btn-xs" onclick="eliminarActivo(${a.id})" title="Eliminar">✕</button>
    </td>
  </tr>`).join('')}
  </tbody></table></div>`;
}

// ── IA organizacional activos evolucionada ────────────────
function renderIAActivos() {
  const panel = document.getElementById('act-ia-panel');
  if (!panel || !activosEmpresariales.length) { if(panel) panel.innerHTML=''; return; }
  const hoy = new Date();
  const recs = [];

  // 1. Sin responsable
  const sinResp = activosEmpresariales.filter(a=>!a.responsable&&a.estado!=='baja');
  if(sinResp.length>0) recs.push({nivel:'crit',icono:'👤',
    texto:`<strong>${sinResp.length} activo${sinResp.length>1?'s':''} sin responsable asignado</strong>: ${sinResp.slice(0,3).map(a=>a.nombre).join(', ')}${sinResp.length>3?'…':''}. Los activos sin custodio son difíciles de rastrear y aumentan el riesgo de pérdida, robo o deterioro.`});

  // 2. Sin ubicación
  const sinUbic = activosEmpresariales.filter(a=>!a.sede&&a.estado!=='baja');
  if(sinUbic.length>0) recs.push({nivel:'warn',icono:'📍',
    texto:`<strong>${sinUbic.length} activo${sinUbic.length>1?'s':''} sin sede registrada</strong>. Sin ubicación es imposible realizar inventarios físicos precisos ni trazabilidad operacional.`});

  // 3. Garantías vencidas
  const garantVenc = activosEmpresariales.filter(a=>a.garantia&&new Date(a.garantia)<hoy&&a.estado!=='baja');
  if(garantVenc.length>0) recs.push({nivel:'warn',icono:'📋',
    texto:`<strong>${garantVenc.length} activo${garantVenc.length>1?'s tienen':'tiene'} garantía vencida</strong>: ${garantVenc.slice(0,3).map(a=>a.nombre).join(', ')}. Considera renovar garantías extendidas o contratos de mantenimiento.`});

  // 4. Garantías próximas a vencer (30 días)
  const garantProx = activosEmpresariales.filter(a=>{
    if(!a.garantia||a.estado==='baja') return false;
    const d=Math.round((new Date(a.garantia)-hoy)/864e5);
    return d>=0&&d<=30;
  });
  if(garantProx.length>0) {
    const garantNombres = garantProx.map(a=>a.nombre+' ('+Math.round((new Date(a.garantia)-new Date())/864e5)+'d)').join(', ');
    recs.push({nivel:'warn',icono:'⏰',
      texto:`<strong>${garantProx.length} activo${garantProx.length>1?'s':''} con garantía próxima a vencer</strong> en los próximos 30 días: ${garantNombres}. Gestionar renovaciones antes del vencimiento.`});
  }

  // 5. Posibles duplicados (mismo nombre + categoría)
  const grupos = {};
  activosEmpresariales.filter(a=>a.estado!=='baja').forEach(a=>{
    const k=`${(a.nombre||'').toLowerCase().slice(0,20)}_${a.categoria}`;
    grupos[k]=(grupos[k]||[]);
    grupos[k].push(a.nombre);
  });
  const dup = Object.entries(grupos).filter(([,v])=>v.length>1);
  if(dup.length>0) recs.push({nivel:'info',icono:'🔄',
    texto:`Se detectan <strong>${dup.length} posible${dup.length>1?'s':''} duplicado${dup.length>1?'s':''}</strong> en el inventario. Verifica que no sean registros dobles del mismo activo para mantener el inventario preciso.`});

  // 6. Sedes con sobrecarga (>10 activos)
  const porSede = {};
  activosEmpresariales.filter(a=>a.sede&&a.estado!=='baja').forEach(a=>{porSede[a.sede]=(porSede[a.sede]||0)+1;});
  const sedeSobr = Object.entries(porSede).filter(([,v])=>v>10).sort((a,b)=>b[1]-a[1]);
  if(sedeSobr.length>0) recs.push({nivel:'info',icono:'🏢',
    texto:`La sede <strong>${sedeSobr[0][0]}</strong> concentra <strong>${sedeSobr[0][1]} activos</strong>. Considera redistribuir activos subutilizados a otras sedes para optimizar los recursos de la organización.`});

  // 7. Activos en mal estado sin acción
  const dañados = activosEmpresariales.filter(a=>a.estado==='dañado');
  if(dañados.length>0) recs.push({nivel:'crit',icono:'⚠️',
    texto:`<strong>${dañados.length} activo${dañados.length>1?'s':''} en estado dañado</strong>: ${dañados.slice(0,3).map(a=>a.nombre).join(', ')}. Definir si se reparan, dan de baja o reemplazan para mantener el inventario actualizado.`});

  // 8. Sin actividad reciente (sin movimientos en mucho tiempo)
  const sinMovim = activosEmpresariales.filter(a=>{
    if(a.estado==='baja') return false;
    if(!a.movimientos?.length&&!a.updatedAt) return false;
    // Has movimientos but none recently — signal possible inactive asset
    return a.movimientos?.length===0&&a.createdAt&&Math.round((hoy-new Date(a.createdAt))/864e5)>90;
  });
  if(sinMovim.length>2) recs.push({nivel:'info',icono:'📦',
    texto:`<strong>${sinMovim.length} activos sin movimiento registrado</strong> desde hace más de 90 días. Verifica si están en uso o pueden ser redistribuidos o dados de baja.`});

  // 9. Depreciación NIC 16 / NIIF para activos con costo registrado
  const hoy9 = new Date();
  const vidaUtilCat = {'Computadores':5,'Portátiles':4,'Servidores':8,'Routers':6,
    'Impresoras':5,'Aires Acondicionados':10,'UPS':8,'Escritorios':10,'Sillas':7,'Cámaras':8,'Otro':5};
  activosEmpresariales.filter(a=>a.costo>0&&a.fechaCompra&&a.estado!=='baja').forEach(a=>{
    const edadA = (hoy9-new Date(a.fechaCompra))/(1000*60*60*24*365.25);
    const vu = vidaUtilCat[a.categoria]||5;
    const vr = a.costo*0.10; // valor residual 10%
    const valorLibros = Math.max(vr, a.costo-(a.costo-vr)/vu*edadA);
    const pctDep = Math.min(100,Math.round((edadA/vu)*100));
    if(pctDep>=80) recs.push({nivel:'warn',icono:'📉',
      texto:`<strong>${a.nombre}</strong> tiene <strong>${pctDep}% de depreciación acumulada</strong> (Línea Recta, NIC 16 / NIIF). Valor libros estimado: <strong>$${Math.round(valorLibros).toLocaleString()} COP</strong> de $${a.costo.toLocaleString()} originales. Evaluar reposición vs mantenimiento correctivo según análisis costo-beneficio.`});
  });
  // Activos con garantía vencida y sin responsable = doble riesgo
  activosEmpresariales.filter(a=>!a.responsable&&a.garantia&&new Date(a.garantia)<hoy9&&a.estado!=='baja').forEach(a=>{
    recs.push({nivel:'crit',icono:'⚠️',
      texto:`<strong>${a.nombre}</strong> (${a.codigo}) tiene garantía vencida Y carece de responsable asignado. Sin custodio ni cobertura de garantía, cualquier falla genera costos correctivos directos sin trazabilidad de responsabilidad.`});
  });


  if(!recs.length) { panel.innerHTML=''; return; }

  const colores = {crit:'rgba(220,53,53,.08)',warn:'rgba(212,150,12,.08)',info:'rgba(14,165,233,.07)'};
  const bordes  = {crit:'var(--red)',warn:'var(--yellow)',info:'var(--blue)'};
  panel.innerHTML = `<div class="card" style="margin-bottom:14px">
    <div class="card-head">
      <span class="card-title">🧠 Análisis IA — Gestión de Activos</span>
      <span class="ai-badge">🤖 ${recs.length} recomendación${recs.length>1?'es':''}</span>
    </div>
    <div class="card-body" style="display:flex;flex-direction:column;gap:8px">
      ${recs.map(r=>`
        <div style="background:${colores[r.nivel]};border-left:3px solid ${bordes[r.nivel]};border-radius:var(--r);padding:10px 14px;display:flex;gap:10px;align-items:flex-start">
          <span style="font-size:1.1rem;flex-shrink:0">${r.icono}</span>
          <span style="font-size:.82rem;color:var(--text2);line-height:1.55">${r.texto}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── Ver hoja de vida del activo ───────────────────────────
function verActivo(id) {
  const a = activosEmpresariales.find(x=>x.id===id);
  if (!a) return;
  activoAccionId = id;
  const hoy = new Date();
  document.getElementById('ver-activo-titulo').textContent = `🗂️ ${a.nombre}`;
  const estadoBadge = {
    operativo:'<span class="badge b-ok">✅ Operativo</span>',
    dañado:'<span class="badge b-warn">⚠️ Dañado</span>',
    mantenimiento:'<span class="badge b-info">🔧 Mantenimiento</span>',
    baja:'<span class="badge b-crit">🔴 Dado de Baja</span>'
  };
  const garantInfo = a.garantia ? (()=>{
    const d=Math.round((new Date(a.garantia)-hoy)/864e5);
    return d<0?`<span style="color:var(--red2)">🔴 Vencida hace ${Math.abs(d)}d</span>`:
           d<=30?`<span style="color:var(--yellow2)">⚠️ Vence en ${d}d</span>`:
           `<span style="color:var(--green2)">✅ Vigente ${d}d</span>`;
  })() : '—';

  // Historial combinado: movimientos + historial
  const histCombinado = [
    ...(a.movimientos||[]).map(m=>({fecha:m.fecha,tipo:'movimiento',icono:'🔄',
      desc:`Movido a ${m.sede||'—'} · ${m.area||'—'} · Responsable: ${m.responsable||'—'}${m.motivo?' — '+m.motivo:''}`})),
    ...(a.historial||[]).map(h=>({fecha:h.fecha,tipo:h.tipo,icono:h.tipo==='edicion'?'✏️':h.tipo==='baja'?'🔴':'📋',desc:h.desc,usuario:h.usuario})),
  ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  document.getElementById('ver-activo-body').innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
      <div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,var(--blue),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">🖥️</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:1rem">${a.nombre}</div>
        <div style="font-size:.75rem;color:var(--text3)">${[a.categoria,a.marca,a.modelo].filter(Boolean).join(' · ')}</div>
        <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">${estadoBadge[a.estado]||''}<span style="font-size:.72rem;color:var(--blue2);font-family:var(--mono);font-weight:700">${a.codigo}</span></div>
      </div>
      ${a.costo?`<div style="text-align:right"><div style="font-size:.8rem;color:var(--green2);font-family:var(--mono);font-weight:700">${fmtCop(a.costo)}</div></div>`:''}
    </div>
    <div class="divider"></div>
    <!-- Datos -->
    <div class="rg-2" style="font-size:.81rem;margin-bottom:12px">
      ${[['N° Serie',a.serial||'—'],['Sede',a.sede||'—'],['Área',a.area||'—'],['Oficina',a.oficina||'—'],
         ['Responsable',a.responsable||'⚠️ Sin asignar'],['Proveedor',a.proveedor||'—'],
         ['Fecha Compra',a.fechaCompra?fmtDate(a.fechaCompra):'—'],['Garantía',garantInfo],
         ['Registrado',a.createdAt?fmtDate(a.createdAt):'—'],['Última edición',a.updatedAt?fmtDate(a.updatedAt):'—'],
      ].map(([k,v])=>`<div class="kv-row" style="border:none;padding:3px 0"><span class="kv-key">${k}</span><span class="kv-val">${v}</span></div>`).join('')}
    </div>
    ${a.obs?`<div style="background:var(--bg);border-radius:var(--r);padding:9px 12px;font-size:.8rem;color:var(--text2);margin-bottom:12px;border:1px solid var(--border)">${a.obs}</div>`:''}
    <!-- Hoja de vida / historial -->
    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text3);letter-spacing:.07em;margin-bottom:8px">
      📋 Hoja de Vida (${histCombinado.length} registros)
    </div>
    ${histCombinado.length ? histCombinado.slice(0,8).map(h=>`
      <div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);font-size:.78rem">
        <span style="font-size:.9rem;flex-shrink:0">${h.icono}</span>
        <div style="flex:1">
          <span style="color:var(--text2)">${h.desc}</span>
          ${h.usuario?`<span style="color:var(--text3);font-size:.69rem"> · ${h.usuario}</span>`:''}
        </div>
        <span style="color:var(--text3);font-family:var(--mono);font-size:.69rem;flex-shrink:0">${fmtDate(h.fecha)}</span>
      </div>`).join('') :
      `<div style="text-align:center;padding:12px;color:var(--text3);font-size:.8rem">Sin registros en la hoja de vida</div>`}`;

  document.getElementById('btn-activo-editar').onclick = () => { closeModal('modal-ver-activo'); abrirModalActivo(id); };
  document.getElementById('btn-activo-mover').onclick  = () => { closeModal('modal-ver-activo'); abrirMoverActivo(id); };
  document.getElementById('btn-activo-qr').onclick     = () => { closeModal('modal-ver-activo'); mostrarQRActivo(id); };
  openModal('modal-ver-activo');
}

// ── Mover / Transferir activo ─────────────────────────────
function abrirMoverActivo(id) {
  activoAccionId = id;
  const a = activosEmpresariales.find(x=>x.id===id);
  if (!a) return;
  document.getElementById('mover-activo-info').innerHTML =
    `<strong>${a.nombre}</strong> (${a.codigo})<br>Ubicación actual: <strong>${a.sede||'—'}</strong> · ${a.area||'—'} · ${a.oficina||'—'}<br>Responsable: <strong>${a.responsable||'Sin asignar'}</strong>`;
  ['mover-sede','mover-area','mover-oficina','mover-responsable','mover-motivo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openModal('modal-mover-activo');
}
function confirmarMovimiento() {
  const a = activosEmpresariales.find(x=>x.id===activoAccionId);
  if (!a) return;
  const sede = document.getElementById('mover-sede').value.trim();
  const resp = document.getElementById('mover-responsable').value.trim();
  const area = document.getElementById('mover-area').value.trim();
  const ofic = document.getElementById('mover-oficina').value.trim();
  const motivo=document.getElementById('mover-motivo').value.trim();
  if (!sede) { toast('⚠️ Error','Ingresa la nueva sede','yellow'); return; }
  if (!a.movimientos) a.movimientos = [];
  const hoy = new Date().toISOString().slice(0,10);
  a.movimientos.push({fecha:hoy,sedePrev:a.sede,areaPrev:a.area,respPrev:a.responsable,sede,responsable:resp,area,oficina:ofic,motivo,usuario:currentUser?.nombre||'Sistema'});
  if (!a.historial) a.historial = [];
  a.historial.push({fecha:hoy,tipo:'movimiento',icono:'🔄',
    desc:`Transferido de ${a.sede||'—'} a ${sede}${resp?' · Nuevo responsable: '+resp:''}${motivo?' — '+motivo:''}`,usuario:currentUser?.nombre||'Sistema'});
  a.sede=sede; if(resp) a.responsable=resp; if(area) a.area=area; if(ofic) a.oficina=ofic; a.updatedAt=hoy;
  guardarActivos(); closeModal('modal-mover-activo'); renderActivos();
  toast('🔄 Activo Transferido',`${a.nombre} → ${sede}`,'green');
}

// ── Baja de activo ────────────────────────────────────────
function abrirBajaActivo(id) {
  activoAccionId = id;
  const a = activosEmpresariales.find(x=>x.id===id);
  if (!a) return;
  document.getElementById('baja-activo-info').innerHTML =
    `<strong>${a.nombre}</strong> (${a.codigo}) · ${a.categoria||''}<br>Sede: ${a.sede||'—'} · Responsable: ${a.responsable||'—'}`;
  document.getElementById('baja-motivo').value='';
  document.getElementById('baja-obs').value='';
  openModal('modal-baja-activo');
}
function confirmarBaja() {
  const a = activosEmpresariales.find(x=>x.id===activoAccionId);
  if (!a) return;
  const motivo=document.getElementById('baja-motivo').value;
  const obs   =document.getElementById('baja-obs').value.trim();
  if (!motivo) { toast('⚠️ Error','Selecciona el motivo de baja','yellow'); return; }
  const hoy = new Date().toISOString().slice(0,10);
  a.estado='baja'; a.motivoBaja=motivo; a.obsBaja=obs; a.fechaBaja=hoy;
  if (!a.historial) a.historial=[];
  a.historial.push({fecha:hoy,tipo:'baja',desc:`Dado de baja. Motivo: ${motivo}${obs?' — '+obs:''}`,usuario:currentUser?.nombre||'Sistema'});
  guardarActivos(); closeModal('modal-baja-activo'); renderActivos(); updateBadges();
  toast('🔴 Activo Dado de Baja',a.nombre,'red');
}

// ── Eliminar activo ───────────────────────────────────────
function eliminarActivo(id) {
  const a = activosEmpresariales.find(x=>x.id===id);
  if (!a) return;
  if (!confirm(`¿Eliminar el activo "${a.nombre}" (${a.codigo}) permanentemente?

Esta acción NO se puede deshacer.
Si deseas conservar el registro, usa "Dar de Baja" en su lugar.`)) return;
  activosEmpresariales = activosEmpresariales.filter(x=>x.id!==id);
  guardarActivos(); renderActivos(); updateBadges();
  toast('🗑 Activo Eliminado',a.nombre,'red');
}

// ── QR activo con hoja de vida ────────────────────────────
let qrActivoActualId = null;
function mostrarQRActivo(id) {
  const a = activosEmpresariales.find(x=>x.id===id);
  if (!a) return;
  qrActivoActualId = id;
  const qrData = JSON.stringify({sistema:'SIMPOE',tipo:'activo',codigo:a.codigo,nombre:a.nombre,
    categoria:a.categoria,sede:a.sede,area:a.area,responsable:a.responsable,estado:a.estado,serial:a.serial});
  const hoy = new Date();
  const garantInfo = a.garantia ? (() => {
    const d=Math.round((new Date(a.garantia)-hoy)/864e5);
    return d<0?`🔴 Garantía vencida`:d<=30?`⚠️ Vence en ${d}d`:`✅ Vigente ${d}d`;
  })() : 'No registrada';
  const body = document.getElementById('modal-qr-activo-body');
  body.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:18px;display:inline-block;margin-bottom:14px">
      <div id="qr-canvas-activo" style="display:flex;align-items:center;justify-content:center"></div>
    </div>
    <div style="background:var(--s3);border-radius:var(--r);padding:13px;text-align:left;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:.9rem;font-weight:800;color:var(--blue2)">SIMPOE · ACTIVOS</div>
        <div style="font-size:.7rem;color:var(--text3);font-family:var(--mono)">${a.codigo}</div>
      </div>
      <div style="font-size:.88rem;font-weight:700;margin-bottom:3px">${a.nombre}</div>
      <div style="font-size:.76rem;color:var(--text2)">${a.categoria||''}${a.marca?' · '+a.marca:''}${a.modelo?' · '+a.modelo:''}</div>
      ${a.sede?`<div style="font-size:.72rem;color:var(--text3);margin-top:4px">📍 ${a.sede}${a.area?' · '+a.area:''}</div>`:''}
      ${a.responsable?`<div style="font-size:.72rem;color:var(--text3)">👤 ${a.responsable}</div>`:''}
      <div style="font-size:.7rem;color:var(--text3)">🛡️ ${garantInfo}</div>
      ${a.serial?`<div style="font-size:.68rem;color:var(--text3);font-family:var(--mono)">S/N: ${a.serial}</div>`:''}
    </div>`;
  openModal('modal-qr-activo');
  setTimeout(()=>{
    const canvas = document.getElementById('qr-canvas-activo');
    if (canvas && typeof QRCode !== 'undefined') {
      canvas.innerHTML='';
      new QRCode(canvas,{text:qrData,width:150,height:150,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    }
  },100);
}
function imprimirQRActivo() {
  const a = activosEmpresariales.find(x=>x.id===qrActivoActualId);
  if (!a) return;
  const qrCanvas = document.querySelector('#qr-canvas-activo canvas, #qr-canvas-activo img');
  const qrSrc = qrCanvas ? (qrCanvas.toDataURL?qrCanvas.toDataURL():qrCanvas.src) : '';
  const hoy = new Date();
  const garantInfo = a.garantia ? (() => {
    const d=Math.round((new Date(a.garantia)-hoy)/864e5);
    return d<0?'Garantía vencida':d<=30?'Vence en '+d+'d':'Vigente '+d+'d';
  })() : '';
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>SIMPOE — ${a.nombre}</title>
  <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;}
  .label{border:2px solid #0ea5e9;border-radius:10px;padding:16px;width:270px;text-align:center;}
  .brand{font-size:.95rem;font-weight:900;letter-spacing:.1em;color:#0ea5e9;margin-bottom:2px;}
  .tipo{font-size:.6rem;color:#666;margin-bottom:6px;text-transform:uppercase;letter-spacing:.07em;}
  .codigo{font-family:monospace;font-size:.72rem;color:#0ea5e9;font-weight:700;margin-bottom:8px;}
  .nombre{font-size:.9rem;font-weight:700;margin-top:8px;color:#111;}
  .meta{font-size:.7rem;color:#555;margin-top:3px;} .serie{font-size:.63rem;font-family:monospace;color:#888;}</style></head><body>
  <div class="label">
    <div class="brand">SIMPOE</div>
    <div class="tipo">Gestión de Activos Empresariales</div>
    <div class="codigo">${a.codigo}</div>
    ${qrSrc?`<img src="${qrSrc}" width="140" height="140">`:
      `<div style="width:140px;height:140px;background:#f5f5f5;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;color:#999">${a.codigo}</div>`}
    <div class="nombre">${a.nombre}</div>
    <div class="meta">${a.categoria||''}${a.sede?' · '+a.sede:''}</div>
    ${a.responsable?`<div class="meta">👤 ${a.responsable}</div>`:''}
    ${garantInfo?`<div class="meta">🛡️ ${garantInfo}</div>`:''}
    ${a.serial?`<div class="serie">S/N: ${a.serial}</div>`:''}
  </div>
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  win.document.close();
}

// ── Exportar CSV activos ──────────────────────────────────




// ══════════════════════════════════════════════
//  FALLAS — Estado y funciones
// ══════════════════════════════════════════════

// Helpers para documentos/fotos en el modal de equipo
function toggleCalibracion() {
  const val = document.getElementById('eq-requiere-cal').value;
  document.getElementById('eq-cal-frecuencia-wrap').style.display = val==='si'?'block':'none';
  document.getElementById('eq-cal-ultima-wrap').style.display     = val==='si'?'block':'none';
}

window._eqDocsTemp = [];
function handleDocSelect(event) {
  Array.from(event.target.files).forEach(f => addDocToList(f, 'eq-docs-lista', '_eqDocsTemp'));
}
function handleDocDrop(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor='var(--border2)';
  Array.from(event.dataTransfer.files).forEach(f => addDocToList(f, 'eq-docs-lista', '_eqDocsTemp'));
}

window._fallaEvidenciaTemp = [];
function handleFallaEvidencia(event) {
  Array.from(event.target.files).forEach(f => {
    if (f.type.startsWith('image/')) addImgPreview(f, 'falla-evidencia-preview', '_fallaEvidenciaTemp');
    else addDocToList(f, 'falla-docs-lista', '_fallaEvidenciaTemp');
  });
}
function handleFallaEvidenciaDrop(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor='var(--border2)';
  Array.from(event.dataTransfer.files).forEach(f => {
    if (f.type.startsWith('image/')) addImgPreview(f, 'falla-evidencia-preview', '_fallaEvidenciaTemp');
    else addDocToList(f, 'falla-docs-lista', '_fallaEvidenciaTemp');
  });
}

let _docUid = 0;

function addDocToList(file, listId, tempKey) {
  const reader = new FileReader();
  reader.onload = e => {
    window[tempKey] = window[tempKey] || [];
    const uid = ++_docUid;
    window[tempKey].push({ _uid:uid, name:file.name, size:file.size, type:file.type, data:e.target.result });
    const el = document.getElementById(listId);
    if (!el) return;
    const item = document.createElement('div');
    item.className = 'doc-item';
    item.dataset.uid = uid;
    item.innerHTML = `<span style="font-size:1rem">${file.type.includes('pdf')?'📄':'📎'}</span>
      <span class="doc-name">${file.name}</span>
      <span style="font-size:.7rem;color:var(--text3)">${(file.size/1024).toFixed(0)}KB</span>
      <button class="doc-remove" data-uid="${uid}">✕</button>`;
    item.querySelector('.doc-remove').onclick = () => {
      item.remove();
      const arr = window[tempKey];
      if (arr) {
        const i = arr.findIndex(d => d._uid === uid);
        if (i !== -1) arr.splice(i, 1);
      }
    };
    el.appendChild(item);
  };
  reader.readAsDataURL(file);
}

function addImgPreview(file, previewId, tempKey) {
  const reader = new FileReader();
  reader.onload = e => {
    window[tempKey] = window[tempKey] || [];
    const uid = ++_docUid;
    window[tempKey].push({ _uid:uid, name:file.name, size:file.size, type:file.type, data:e.target.result });
    const el = document.getElementById(previewId);
    if (!el) return;
    const img = document.createElement('img');
    img.src = e.target.result;
    img.className = 'falla-img-thumb';
    img.title = file.name;
    img.dataset.uid = uid;
    img.onclick = () => { const w=window.open(); w.document.write(`<img src="${e.target.result}" style="max-width:100%">`); };
    el.appendChild(img);
  };
  reader.readAsDataURL(file);
}

// Abrir modal falla — prellenar equipo selector y datos del usuario
function abrirModalFalla() {
  // Populate equipo selector
  const sel = document.getElementById('falla-equipo');
  sel.innerHTML = '<option value="">— Selecciona el equipo —</option>' +
    equipos.map(e=>`<option value="${e.id}">${e.nombre} (${e.tipo})</option>`).join('');

  // Set fecha today
  document.getElementById('falla-fecha').value = new Date().toISOString().slice(0,10);

  // Clear form
  ['falla-desc','falla-area'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('falla-urgencia').value='media';
  document.getElementById('falla-evidencia-preview').innerHTML='';
  document.getElementById('falla-docs-lista').innerHTML='';
  window._fallaEvidenciaTemp=[];

  // Set reportante info
  if (currentUser) {
    const av = document.getElementById('falla-reportante-avatar');
    const nm = document.getElementById('falla-reportante-nombre');
    const rl = document.getElementById('falla-reportante-rol');
    const initials = currentUser.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    if(av) av.textContent = initials;
    if(nm) nm.textContent = currentUser.nombre;
    if(rl) rl.textContent = currentUser.role==='admin'?'👑 Administrador':currentUser.role==='tecnico'?'🔧 Técnico':'⚠️ Operador';
  }

  openModal('modal-falla');
}

function guardarFalla() {
  const equipoId  = +document.getElementById('falla-equipo').value;
  const fecha     = document.getElementById('falla-fecha').value;
  const desc      = document.getElementById('falla-desc').value.trim();
  const urgencia  = document.getElementById('falla-urgencia').value;
  const area      = document.getElementById('falla-area').value.trim();
  const evidencia = window._fallaEvidenciaTemp || [];

  limpiarErrores(['falla-equipo','falla-fecha','falla-desc']);
  let fvalid = true;
  if (!equipoId) { validarCampo('falla-equipo','Selecciona el equipo afectado'); fvalid=false; }
  if (!fecha)    { validarCampo('falla-fecha','La fecha es obligatoria');         fvalid=false; }
  if (!desc)     { validarCampo('falla-desc','Describe qué ocurrió con el equipo'); fvalid=false; }
  if (!fvalid) { toast('⚠️ Formulario incompleto','Completa los campos marcados en rojo','yellow'); return; }

  const eq = equipos.find(e=>e.id===equipoId);
  fallas.push({
    id:          nextFallaId++,
    equipoId,
    equipoNombre: eq ? eq.nombre : '—',
    fecha,
    desc,
    urgencia,
    area:        area || eq?.ubicacion || '—',
    evidencia,
    reportadoPor: currentUser ? currentUser.nombre : '—',
    rolReportante: currentUser ? currentUser.role : '—',
    estado:      'reportada',
    creadoEn:    new Date().toISOString()
  });

  window._fallaEvidenciaTemp = [];
  closeModal('modal-falla');
  guardarDatos();
  updateBadges();
  renderFallas();
  const urgTxt = urgencia==='alta'?'🔴 URGENTE — Atención inmediata requerida':
                 urgencia==='media'?'🟡 Media prioridad':
                 '🟢 Baja prioridad';
  toast('⚠️ Falla Reportada', `${eq?.nombre||'Equipo'} · ${urgTxt}`, urgencia==='alta'?'red':'yellow');
}

function renderFallas() {
  const filtro = (document.getElementById('falla-filtro')||{}).value||'all';
  const pendientes = fallas.filter(f=>f.estado!=='resuelta').length;
  const alta       = fallas.filter(f=>f.urgencia==='alta').length;
  const enProceso  = fallas.filter(f=>f.estado==='en_proceso').length;

  const statsEl = document.getElementById('falla-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="card"><div class="card-body" style="text-align:center;padding:14px">
        <div style="font-size:1.8rem;font-weight:800;font-family:var(--mono);color:var(--red2)">${pendientes}</div>
        <div class="cls-stat-sub">Fallas Pendientes</div>
      </div></div>
      <div class="card"><div class="card-body" style="text-align:center;padding:14px">
        <div style="font-size:1.8rem;font-weight:800;font-family:var(--mono);color:var(--yellow2)">${alta}</div>
        <div class="cls-stat-sub">Urgencia Alta</div>
      </div></div>
      <div class="card"><div class="card-body" style="text-align:center;padding:14px">
        <div style="font-size:1.8rem;font-weight:800;font-family:var(--mono);color:var(--blue2)">${enProceso}</div>
        <div class="cls-stat-sub">En Proceso</div>
      </div></div>`;
  }

  let data = [...fallas].sort((a,b)=>{
    const ord={alta:0,media:1,baja:2};
    return (ord[a.urgencia]||1)-(ord[b.urgencia]||1);
  });
  if (filtro==='alta')      data=data.filter(f=>f.urgencia==='alta');
  else if (filtro==='media') data=data.filter(f=>f.urgencia==='media');
  else if (filtro==='baja')  data=data.filter(f=>f.urgencia==='baja');
  else if (filtro==='reportada')   data=data.filter(f=>f.estado==='reportada');
  else if (filtro==='en_proceso') data=data.filter(f=>f.estado==='en_proceso');
  else if (filtro==='resuelta')   data=data.filter(f=>f.estado==='resuelta');

  const listEl = document.getElementById('fallas-list');
  if (!listEl) return;

  if (!data.length) {
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">✅</div><p>${filtro==='all'?'No hay fallas reportadas aún. Usa el botón "+ Reportar Falla" para registrar un incidente.':'No hay fallas con este filtro.'}</p></div>`;
    return;
  }

  const urgIcon  = {alta:'🔴',media:'🟡',baja:'🟢'};
  const urgLabel = {alta:'Alta — Atención inmediata',media:'Media — Intervenir en 24-48h',baja:'Baja — Programar revisión'};
  const rolIcon  = {admin:'👑',tecnico:'🔧',reportante:'📋'};

  listEl.innerHTML = data.map(f=>`
    <div class="falla-card urg-${f.urgencia}" onclick="verFalla(${f.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-weight:800;font-size:.95rem">${f.equipoNombre}</div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:2px">${fmtDate(f.fecha)} · ${f.area}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
          <span class="badge ${f.urgencia==='alta'?'b-crit':f.urgencia==='media'?'b-warn':'b-ok'}">
            <span class="badge-dot"></span>${urgIcon[f.urgencia]} Urgencia ${f.urgencia.charAt(0).toUpperCase()+f.urgencia.slice(1)}
          </span>
          <span class="badge ${f.estado==='resuelta'?'b-ok':f.estado==='en_proceso'?'b-info':'b-crit'}">
            ${f.estado==='resuelta'?'✅ Resuelta':f.estado==='en_proceso'?'🔧 En Proceso':'🔴 Reportada'}
          </span>
        </div>
      </div>
      <div style="font-size:.83rem;color:var(--text2);background:var(--bg);padding:9px 11px;border-radius:var(--r);border:1px solid var(--border);margin-bottom:9px">${f.desc.slice(0,160)}${f.desc.length>160?'…':''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:.75rem;color:var(--text3)">${rolIcon[f.rolReportante]||'👤'} ${f.reportadoPor}</div>
        <div style="display:flex;gap:6px">
          ${f.evidencia&&f.evidencia.length?`<span class="chip">📷 ${f.evidencia.length} evidencia${f.evidencia.length>1?'s':''}</span>`:''}
          <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();verFalla(${f.id})">Ver detalle →</button>
        </div>
      </div>
    </div>`).join('');
}

function verFalla(id) {
  const f = fallas.find(x=>x.id===id);
  if (!f) return;
  const urgIcon  = {alta:'🔴',media:'🟡',baja:'🟢'};
  const urgLabel = {alta:'Alta — Atención inmediata requerida',media:'Media — Intervenir en 24–48h',baja:'Baja — Programar revisión'};
  const rolIcon  = {admin:'👑',tecnico:'🔧',reportante:'📋'};

  document.getElementById('ver-falla-titulo').textContent = `⚠️ Falla — ${f.equipoNombre}`;
  document.getElementById('ver-falla-body').innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <span class="badge ${f.urgencia==='alta'?'b-crit':f.urgencia==='media'?'b-warn':'b-ok'}"><span class="badge-dot"></span>${urgIcon[f.urgencia]} Urgencia ${urgLabel[f.urgencia]}</span>
      <span class="badge ${f.estado==='resuelta'?'b-ok':f.estado==='en_proceso'?'b-info':'b-warn'}">${f.estado==='resuelta'?'✅ Resuelta':f.estado==='en_proceso'?'🔧 En Proceso':'🔴 Reportada'}</span>
    </div>
    <div class="kv-row"><span class="kv-key">Equipo afectado</span><span class="kv-val">${f.equipoNombre}</span></div>
    <div class="kv-row"><span class="kv-key">Fecha de falla</span><span class="kv-val" style="font-family:var(--mono)">${fmtDate(f.fecha)}</span></div>
    <div class="kv-row"><span class="kv-key">Área / Ubicación</span><span class="kv-val">${f.area}</span></div>
    <div class="kv-row"><span class="kv-key">Reportado por</span><span class="kv-val">${rolIcon[f.rolReportante]||'👤'} ${f.reportadoPor}</span></div>
    <div class="divider"></div>
    <div style="font-size:.78rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Descripción de la falla</div>
    <div style="background:var(--bg);border-radius:var(--r);padding:10px 13px;border:1px solid var(--border);font-size:.84rem;color:var(--text2);white-space:pre-wrap;margin-bottom:12px">${f.desc}</div>
    ${f.evidencia&&f.evidencia.length?`
      <div style="font-size:.78rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Evidencia adjunta (${f.evidencia.length})</div>
      <div class="falla-img-preview" style="margin-bottom:8px">
        ${f.evidencia.filter(e=>e.type&&e.type.startsWith('image/')).map(e=>`<img src="${e.data}" class="falla-img-thumb" onclick="window.open().document.write('<img src=\\'${e.data}\\' style=\\'max-width:100%\\'>'">`).join('')}
      </div>
      ${f.evidencia.filter(e=>e.type&&!e.type.startsWith('image/')).map(e=>`<div class="doc-item"><span>📄</span><span class="doc-name">${e.name}</span><a href="${e.data}" download="${e.name}" style="font-size:.75rem;color:var(--blue2)">Descargar</a></div>`).join('')}
    `:'<div style="font-size:.81rem;color:var(--text3);margin-bottom:10px">Sin evidencia adjunta.</div>'}`;

  const btnAt = document.getElementById('btn-marcar-atendida');
  if (btnAt) {
    if (f.estado==='atendida') {
      btnAt.textContent='✅ Ya atendida';
      btnAt.disabled=true;
    } else {
      btnAt.textContent='✅ Marcar como Atendida';
      btnAt.disabled=false;
      btnAt.onclick=()=>{ f.estado='atendida'; guardarDatos(); closeModal('modal-ver-falla'); renderFallas(); updateBadges(); toast('✅ Falla Atendida',f.equipoNombre,'green'); };
    }
    // Solo admin y tecnico pueden marcar como atendida
    btnAt.style.display = (currentUser&&(currentUser.role==='admin'||currentUser.role==='tecnico'))?'inline-flex':'none';
  }

  openModal('modal-ver-falla');
}

// ══════════════════════════════════════════════
//  MEJORAS v5 — BÚSQUEDA, EXPORTAR, FALLAS, IA
// ══════════════════════════════════════════════

// ── BÚSQUEDA: empty state helper ─────────────────────────────
function emptyState(icon, title, sub) {
  return `<div class="search-empty">
    <div class="search-empty-icon">${icon}</div>
    <div class="search-empty-title">${title}</div>
    <div class="search-empty-sub">${sub}</div>
  </div>`;
}

// Shortcut: superadmin adds user directly to a specific company
function agregarUsuarioEmpresa(empresaId) {
  if (!currentUser || currentUser.role !== 'superadmin') return;

  const creadorEl = document.getElementById('modal-usr-creador');
  if (creadorEl) creadorEl.textContent = currentUser.nombre;

  ['nu-nombre','nu-email','nu-pass','nu-pass2'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const errEl = document.getElementById('nu-error');
  if (errEl) errEl.style.display='none';

  // Pre-select the target company
  const empSel = document.getElementById('nu-empresa-id');
  const wrapEl = document.getElementById('nu-empresa-wrap');
  if (empSel) {
    empSel.innerHTML = '<option value="">— Selecciona empresa —</option>' +
      empresas.filter(e=>e.activa).map(e=>`<option value="${e.id}" ${e.id===empresaId?'selected':''}>${e.nombre}</option>`).join('');
    if (wrapEl) wrapEl.style.display='block';
  }

  // Role options for superadmin
  const roleEl = document.getElementById('nu-role');
  if (roleEl) {
    roleEl.innerHTML = `
      <option value="admin">👑 Administrador — Control completo dentro de la empresa</option>
      <option value="tecnico" selected>🔧 Técnico — Equipos, mantenimientos, consultas operativas</option>
      <option value="operador">⚠️ Operador — Solo reporte de fallas</option>`;
  }

  openModal('modal-nuevo-usuario');
}

// ── EXPORTAR CSV ──────────────────────────────────────────────




// ── ACTUALIZAR verFalla con botones multi-estado ──────────────
const _origVerFalla = verFalla;
verFalla = function(id) {
  const f = fallas.find(x=>x.id===id);
  if (!f) return;

  // Call original to build body
  _origVerFalla(id);

  // Now wire up multi-state buttons
  const btnProc = document.getElementById('btn-en-proceso');
  const btnRes  = document.getElementById('btn-marcar-atendida');
  const canEdit = currentUser && (currentUser.role==='admin' || currentUser.role==='superadmin' || currentUser.role==='tecnico');

  if (btnProc && btnRes) {
    if (!canEdit) { btnProc.style.display='none'; btnRes.style.display='none'; return; }

    if (f.estado === 'reportada') {
      btnProc.style.display='inline-flex'; btnProc.textContent='🔧 Pasar a En Proceso';
      btnRes.style.display='inline-flex';  btnRes.textContent='✅ Marcar Resuelta';
      btnProc.onclick = () => { f.estado='en_proceso'; guardarDatos(); closeModal('modal-ver-falla'); renderFallas(); updateBadges(); toast('🔧 En Proceso', f.equipoNombre, 'blue'); };
      btnRes.onclick  = () => { f.estado='resuelta';   guardarDatos(); closeModal('modal-ver-falla'); renderFallas(); updateBadges(); toast('✅ Resuelta', f.equipoNombre, 'green'); };
    } else if (f.estado === 'en_proceso') {
      btnProc.style.display='none';
      btnRes.style.display='inline-flex'; btnRes.textContent='✅ Marcar Resuelta';
      btnRes.onclick = () => { f.estado='resuelta'; guardarDatos(); closeModal('modal-ver-falla'); renderFallas(); updateBadges(); toast('✅ Resuelta', f.equipoNombre, 'green'); };
    } else {
      btnProc.style.display='none';
      btnRes.style.display='none';
    }
  }
};

// ── VALIDACIÓN DE FORMULARIOS ─────────────────────────────────
function validarCampo(id, msg) {
  const el = document.getElementById(id);
  if (!el) return true;
  const val = el.value.trim();
  const ok  = val.length > 0 && val !== '0';
  el.classList.toggle('input-error', !ok);
  // Remove old error msg
  const prev = el.parentElement.querySelector('.error-msg');
  if (prev) prev.remove();
  if (!ok) {
    const em = document.createElement('span');
    em.className = 'error-msg';
    em.textContent = msg;
    el.parentElement.appendChild(em);
  }
  return ok;
}

function limpiarErrores(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('input-error');
    const prev = el.parentElement?.querySelector('.error-msg');
    if (prev) prev.remove();
  });
}

// ── IA MÁS ESPECÍFICA: tooltip contextual por equipo ─────────

// ── INDICADOR DE MÓDULO ACTIVO ────────────────────────────────
// Highlight current nav item with stronger visual cue
const _origGoView = goView;
goView = function(view, el) {
  _origGoView(view, el);
  // Update page title indicator
  const titles = {
    dashboard:'🎛 Centro de Control Operacional', equipos:'⚙️ Equipos', calculo:'🧮 Cálculo de Vida Útil',
    costos:'💸 Análisis de Costos', productividad:'⏱ Productividad', ia:'🧠 IA / Análisis',
    alertas:'🔔 Alertas', historial:'📋 Historial', mantenimiento:'🔧 Mantenimiento',
    reporte:'📄 Reporte', fallas:'⚠️ Reporte de Fallas', usuarios:'👥 Usuarios', empresas:'🏢 Empresas'
  };
  const indicator = document.getElementById('modulo-activo');
  if (indicator && titles[view]) indicator.textContent = titles[view];
};


// ══════════════════════════════════════════════
//  SISTEMA MULTISECTOR — Adaptación por tipo
// ══════════════════════════════════════════════

// Tipo de empresa activa

// ── Selector de tipo en modal nueva empresa ───────────────

// ── Config por tipo de empresa ────────────────────────────
const SECTOR_CONFIG = {
  // ─────────────────────────────── 🚌 TRANSPORTE ──────
  transporte: {
    icono:'🚌', nombre:'Transporte', activos:'Vehículos / Buses', iconoActivo:'🚌',
    dashboard:{
      stat1:{label:'Vehículos Activos',   icono:'🚌'},
      stat2:{label:'En Circulación',      icono:'✅'},
      stat3:{label:'En Mantenimiento',    icono:'🔧'},
      stat4:{label:'Alertas Documentales',icono:'📋'},
    },
    mantenimientoKm:[
      {tipo:'Cambio de aceite',          cadaKm:10000, prioridad:'alta'},
      {tipo:'Revisión de frenos',        cadaKm:20000, prioridad:'alta'},
      {tipo:'Rotación de llantas',       cadaKm:15000, prioridad:'media'},
      {tipo:'Cambio de filtros',         cadaKm:12000, prioridad:'media'},
      {tipo:'Revisión general',          cadaKm:30000, prioridad:'alta'},
      {tipo:'Cambio de correa',          cadaKm:50000, prioridad:'alta'},
    ],
    camposExtra:[
      // ── Identificación vehicular ──────────────────────
      {id:'eq-placa',       label:'Placa *',             placeholder:'Ej: ABC-123',       hint:'Placa oficial del vehículo.'},
      {id:'eq-anio',        label:'Año del vehículo',    placeholder:'Ej: 2019',          type:'number', hint:'Año de fabricación.'},
      {id:'eq-chasis',      label:'N° Chasis / VIN',     placeholder:'Ej: 9BWZZZ377VT004251', hint:'Número de identificación vehicular.'},
      {id:'eq-motor-tipo',  label:'Tipo de motor',       placeholder:'Ej: Cummins ISB 6.7', hint:'Referencia del motor.'},
      {id:'eq-capacidad',   label:'Capacidad pasajeros', placeholder:'Ej: 45',            type:'number'},
      {id:'eq-combustible', label:'Combustible', tipo:'select', opciones:['Diesel','Gasolina','Gas Natural','Eléctrico','Híbrido']},
      // ── Operación ─────────────────────────────────────
      {id:'eq-km',          label:'Kilometraje actual *', placeholder:'Ej: 85000',        type:'number', hint:'Km actuales del odómetro.'},
      {id:'eq-km-ini',      label:'Km en último mant.',   placeholder:'Ej: 75000',        type:'number', hint:'Km registrados en el último servicio.'},
      {id:'eq-conductor',   label:'Conductor asignado',   placeholder:'Ej: Pedro Martínez'},
      {id:'eq-lic-conductor',label:'Licencia conductor',  placeholder:'Ej: C2-1234567'},
      {id:'eq-ruta',        label:'Ruta asignada',        placeholder:'Ej: Ruta 15 Norte'},
      {id:'eq-horas-dia',   label:'Horas operación/día',  placeholder:'Ej: 12',           type:'number'},
      {id:'eq-cond-op',     label:'Condición de operación', tipo:'select', opciones:['Normal','Alta intensidad','Montañosa','Urbana congestionada','Mixta']},
      // ── Estado mecánico ───────────────────────────────
      {id:'eq-frenos',      label:'Estado frenos', tipo:'select', opciones:['Óptimo','Requiere revisión','Desgaste moderado','Crítico']},
      {id:'eq-llantas',     label:'Estado llantas', tipo:'select', opciones:['Buen estado','Desgaste moderado','Cambio próximo','Cambio urgente']},
      {id:'eq-suspension',  label:'Estado suspensión', tipo:'select', opciones:['Óptima','Requiere revisión','Deteriorada']},
      {id:'eq-transmision', label:'Estado transmisión', tipo:'select', opciones:['Óptima','Requiere revisión','Con fallas']},
      // ── Control documental ────────────────────────────
      {id:'eq-soat',        label:'Vencimiento SOAT *',              placeholder:'', type:'date', hint:'Obligatorio. Seguro Obligatorio de Accidentes de Tránsito.'},
      {id:'eq-tecno',       label:'Vencimiento Tecnomecánica *',     placeholder:'', type:'date', hint:'Revisión técnico-mecánica obligatoria.'},
      {id:'eq-poliza',      label:'Vencimiento Póliza de Seguros',   placeholder:'', type:'date'},
      {id:'eq-tarj-op',     label:'Vencimiento Tarjeta de Operación',placeholder:'', type:'date'},
      {id:'eq-lic-cond',    label:'Vencimiento Licencia Conductor',  placeholder:'', type:'date'},
      {id:'eq-seguro-extra',label:'Vencimiento Seguro Adicional',    placeholder:'', type:'date'},
    ],
    ia:{
      factores:['kilometraje','documentos','frenos','llantas','historial'],
      alertaVenc:(extra={})=>{
        const hoy=new Date(); const msgs=[];
        const docs=[['soat','SOAT'],['tecno','Tecnomecánica'],['poliza','Póliza'],['tarj-op','Tarjeta Operación'],['lic-cond','Licencia Conductor']];
        docs.forEach(([k,label])=>{
          const val=extra[k]||extra['eq-'+k];
          if(!val) return;
          const d=Math.round((new Date(val)-hoy)/864e5);
          if(d<=30) msgs.push({texto:`${label} ${d<=0?'VENCIDA ('+Math.abs(d)+'d)':'vence en '+d+'d'}`,nivel:d<=0?'crit':d<=7?'crit':'warn'});
        });
        return msgs;
      }
    }
  },
  // ─────────────────────────────── ⚙️ INDUSTRIAL ──────
  industrial: {
    icono:'⚙️', nombre:'Industrial', activos:'Equipos / Máquinas', iconoActivo:'⚙️',
    dashboard:{
      stat1:{label:'Equipos Operativos',    icono:'⚙️'},
      stat2:{label:'Salud Operacional',     icono:'❤️'},
      stat3:{label:'Equipos Críticos',      icono:'🔴'},
      stat4:{label:'Disponibilidad Planta', icono:'📊'},
    },
    // Intervalos base por horas — ajustados por IA según condiciones
    mantenimientoHoras:[
      {id:'lubricacion',   nombre:'Lubricación general',           cadaHoras:500,  prioridad:'alta',  icono:'🛢️'},
      {id:'inspeccion',    nombre:'Inspección preventiva',         cadaHoras:1000, prioridad:'alta',  icono:'🔍'},
      {id:'electrica',     nombre:'Revisión eléctrica y sensores', cadaHoras:800,  prioridad:'media', icono:'⚡'},
      {id:'calibracion',   nombre:'Calibración técnica',           cadaHoras:1500, prioridad:'media', icono:'🎯'},
      {id:'componentes',   nombre:'Cambio de componentes clave',   cadaHoras:2000, prioridad:'alta',  icono:'🔩'},
      {id:'rodamientos',   nombre:'Revisión de rodamientos',       cadaHoras:3000, prioridad:'alta',  icono:'⭕'},
      {id:'refrigeracion', nombre:'Sistema de refrigeración',      cadaHoras:1200, prioridad:'media', icono:'🌡️'},
      {id:'sellados',      nombre:'Revisión de sellos y juntas',   cadaHoras:2500, prioridad:'media', icono:'🔒'},
    ],
    camposExtra:[
      // ── Identificación técnica ──────────────────────
      {id:'eq-cod-interno',  label:'Código interno equipo',    placeholder:'Ej: MQ-001',    hint:'Código de identificación en planta.'},
      {id:'eq-area-planta',  label:'Área de planta',           placeholder:'Ej: Línea 3 - Producción'},
      {id:'eq-tecnico-resp', label:'Técnico responsable',      placeholder:'Ej: Juan López'},
      {id:'eq-criticidad',   label:'Criticidad del equipo', tipo:'select', opciones:['Alta — Producción crítica','Media — Afecta parcialmente','Baja — No crítico'],
        hint:'Impacto en producción si falla.'},
      {id:'eq-cond-trabajo', label:'Condición de trabajo', tipo:'select',
        opciones:['Normal','Polvo / Partículas','Alta temperatura ambiente','Humedad / Vapor','Vibraciones externas','Corrosivo','Mixta'],
        hint:'Ambiente operativo del equipo.'},
      // ── Variables operacionales ───────────────────────
      {id:'eq-horas-acum-ind',label:'Horas acumuladas op.',   placeholder:'Ej: 4500',  type:'number', hint:'Total horas operativas acumuladas.'},
      {id:'eq-horas-ult-mant',label:'Horas en último mant.',  placeholder:'Ej: 3500',  type:'number', hint:'Horas al momento del último mantenimiento.'},
      {id:'eq-vibracion',     label:'Vibración actual (mm/s)',placeholder:'Ej: 2.5',   hint:'Lectura del sensor. Límite recomendado: 4.5 mm/s.'},
      {id:'eq-temperatura',   label:'Temperatura op. (°C)',   placeholder:'Ej: 75',    hint:'Temperatura normal de operación.'},
      {id:'eq-temp-max',      label:'Temperatura máxima (°C)',placeholder:'Ej: 95',    hint:'Temperatura límite antes de alarma.'},
      {id:'eq-presion',       label:'Presión de trabajo',     placeholder:'Ej: 6 bar', hint:'Presión de operación si aplica.'},
      {id:'eq-amperaje',      label:'Amperaje nominal (A)',   placeholder:'Ej: 15.5',  hint:'Corriente nominal de operación.'},
      {id:'eq-rpm',           label:'RPM de operación',       placeholder:'Ej: 1450',  type:'number'},
      // ── Estado y métricas ────────────────────────────
      {id:'eq-desgaste-ind',  label:'Nivel de desgaste', tipo:'select', opciones:['Mínimo — Normal','Moderado — Monitorear','Avanzado — Programar mant.','Crítico — Intervención urgente']},
      {id:'eq-tiempo-det',    label:'Tiempo detenido (h)',    placeholder:'Ej: 5',     type:'number', hint:'Horas detenido en el período actual.'},
      {id:'eq-prod-pct',      label:'Productividad actual (%)',placeholder:'Ej: 85',  type:'number', hint:'% de tiempo operando vs disponible.'},
      {id:'eq-nro-fallas',    label:'N° fallas recientes',   placeholder:'Ej: 2',     type:'number', hint:'Fallas en los últimos 30 días.'},
      {id:'eq-ultimo-mant-tipo',label:'Tipo último mant.', tipo:'select', opciones:['Preventivo','Correctivo','Predictivo','Inspección']},
    ],
    ia:{
      factores:['horas ajustadas','vibración','temperatura','desgaste','historial fallas','condición trabajo'],
      alertaVenc:()=>[]
    }
  },
  // ─────────────────────────────── 🏗️ CONSTRUCCIÓN ──────
  construccion: {
    icono:'🏗️', nombre:'Construcción', activos:'Maquinaria Pesada', iconoActivo:'🏗️',
    dashboard:{
      stat1:{label:'Maquinaria Activa',      icono:'🏗️'},
      stat2:{label:'Disponibilidad Flota',   icono:'📊'},
      stat3:{label:'Mant. Urgentes IA',      icono:'🔧'},
      stat4:{label:'Equipos Críticos',       icono:'🔴'},
    },
    mantenimientoHoras:[
      {id:'lubricacion-hid', nombre:'Lubricación sistema hidráulico',       cadaHoras:500,  prioridad:'alta',  icono:'💧'},
      {id:'filtros',         nombre:'Cambio de filtros (aceite/aire/hid.)',  cadaHoras:800,  prioridad:'alta',  icono:'🔄'},
      {id:'insp-estructural',nombre:'Inspección estructural',                cadaHoras:1000, prioridad:'alta',  icono:'🔩'},
      {id:'tren-rodaje',     nombre:'Revisión tren de rodaje',               cadaHoras:1500, prioridad:'alta',  icono:'⭕'},
      {id:'motor',           nombre:'Mantenimiento de motor',                cadaHoras:2000, prioridad:'alta',  icono:'⚙️'},
      {id:'transmision',     nombre:'Revisión de transmisión',               cadaHoras:2500, prioridad:'media', icono:'🔗'},
      {id:'electrico',       nombre:'Sistema eléctrico y sensores',          cadaHoras:1200, prioridad:'media', icono:'⚡'},
      {id:'componentes-des', nombre:'Reemplazo componentes de desgaste',     cadaHoras:3000, prioridad:'alta',  icono:'🛠️'},
    ],
    camposExtra:[
      {id:'eq-tipo-maq',     label:'Tipo de maquinaria', tipo:'select',
        opciones:['Excavadora','Retroexcavadora','Bulldozer','Grúa','Compactadora','Cargador frontal','Motoniveladora','Volqueta','Pavimentadora','Perforadora','Generador','Otro'],
        hint:'Tipo específico de maquinaria pesada.'},
      {id:'eq-capacidad',    label:'Capacidad / Potencia',  placeholder:'Ej: 20 ton / 150 HP'},
      {id:'eq-operador',     label:'Operador asignado',     placeholder:'Ej: Luis Moreno'},
      {id:'eq-lic-op',       label:'Licencia operador',     placeholder:'Ej: LOP-2024-001'},
      {id:'eq-ub-obra',      label:'Ubicación en obra',     placeholder:'Ej: Bloque C - Excavación'},
      {id:'eq-proyecto',     label:'Proyecto / Obra',       placeholder:'Ej: Torre Brisas del Mar'},
      {id:'eq-horas-maq',    label:'Horas máquina actuales *', placeholder:'Ej: 2400', type:'number', hint:'Total horas acumuladas del horómetro.'},
      {id:'eq-horas-maq-ini',label:'Horas en último mant.',    placeholder:'Ej: 2000', type:'number'},
      {id:'eq-combustible',  label:'Combustible', tipo:'select', opciones:['Diesel','Gasolina','Gas Natural']},
      {id:'eq-consumo-comb', label:'Consumo combustible (L/h)',placeholder:'Ej: 15.5'},
      {id:'eq-nivel-trabajo',label:'Nivel de exigencia obra', tipo:'select',
        opciones:['Normal — Terreno plano','Alta — Terreno difícil','Muy alta — Demolición/Roca','Extrema — Condiciones adversas'],
        hint:'Determina el factor de ajuste de los intervalos IA.'},
      {id:'eq-turno',        label:'Turnos de operación', tipo:'select',
        opciones:['1 turno (8h/día)','2 turnos (16h/día)','3 turnos (24h/día)']},
      {id:'eq-presion-hid',  label:'Presión hidráulica (bar)',placeholder:'Ej: 200'},
      {id:'eq-pres-max',     label:'Presión máx. admisible (bar)',placeholder:'Ej: 250'},
      {id:'eq-temperatura',  label:'Temperatura motor (°C)', placeholder:'Ej: 85'},
      {id:'eq-desg-estruc',  label:'Desgaste estructural', tipo:'select',
        opciones:['Sin daños — Óptimo','Desgaste leve — Normal','Desgaste moderado — Monitorear','Daño estructural — Urgente']},
      {id:'eq-estado-hid',   label:'Estado sistema hidráulico', tipo:'select',
        opciones:['Óptimo','Requiere revisión','Fuga detectada','Falla hidráulica']},
      {id:'eq-nro-fallas',   label:'Fallas últimos 30 días', placeholder:'Ej: 2', type:'number'},
    ],
    ia:{factores:['horas máquina','presión hidráulica','temperatura','desgaste estructural','exigencia obra'],alertaVenc:()=>[]}
  },
  activos: {
    icono:'🗂️', nombre:'Gestión de Activos', activos:'Activos Empresariales', iconoActivo:'🖥️',
    dashboard:{
      stat1:{label:'Total Activos',        icono:'🗂️'},
      stat2:{label:'Activos Operativos',   icono:'✅'},
      stat3:{label:'Dañados / Baja',       icono:'⚠️'},
      stat4:{label:'Sin Responsable',      icono:'👤'},
    },
    camposExtra:[],
    ia:{factores:['responsable','ubicación','estado','duplicados'],alertaVenc:()=>[]}
  }
};

// ── Campos extra del sector en el modal equipo ────────────

// ── Leer campos extra al guardar equipo ───────────────────

// ── Dashboard adaptado por sector ─────────────────────────

// ── Nombre del activo según sector ────────────────────────

// ── IA análisis sector-aware ──────────────────────────────


// ══════════════════════════════════════════════
//  INIT — carga datos guardados o usa demo
// ══════════════════════════════════════════════

(async function init() {
  const loaded = await cargarDatos();
  if (loaded) {
    console.log(`SIMPOE: ${equipos.length} equipos y ${mantenimientos.length} mantenimientos cargados desde almacenamiento local.`);
  }
})();
