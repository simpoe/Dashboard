-- ══════════════════════════════════════════════════════════
--  SIMPOE — Supabase Migration
--  Sistema Inteligente de Mantenimiento Predictivo Operacional
-- ══════════════════════════════════════════════════════════

-- ── Extensions ──
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ── ENUMs (con IF NOT EXISTS para poder re-ejecutar) ──
do $$ begin
  create type rol_usuario as enum ('superadmin', 'admin', 'tecnico', 'operador');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type tipo_empresa as enum ('transporte', 'industrial', 'construccion', 'activos');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type criticidad_equipo as enum ('alta', 'media', 'baja');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type tipo_mantenimiento as enum ('Preventivo', 'Correctivo', 'Predictivo');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type urgencia_falla as enum ('alta', 'media', 'baja');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type estado_falla as enum ('reportada', 'en_proceso', 'resuelta');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type estado_activo as enum ('operativo', 'danado', 'mantenimiento', 'baja');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type tipo_equipo as enum (
    'Motor', 'Bomba', 'Aire Acondicionado', 'Compresor',
    'Bus / Vehiculo', 'Generador', 'Transformador',
    'Banda Transportadora', 'Otro'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type categoria_activo as enum (
    'Computadores', 'Portatiles', 'Impresoras', 'Teclados', 'Mouses',
    'Escritorios', 'Sillas', 'Aires Acondicionados', 'Televisores',
    'Routers', 'Camaras', 'UPS', 'Servidores', 'Otro'
  );
exception when duplicate_object then null;
end $$;

-- ── TABLAS (con IF NOT EXISTS para poder re-ejecutar) ──

-- 1. EMPRESAS
create table if not exists empresas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  nit         text not null unique,
  tipo        tipo_empresa not null default 'industrial',
  responsable text not null,
  ciudad      text not null default '',
  pais        text not null default 'Colombia',
  telefono    text default '',
  email       text default '',
  color       text default '#e87820',
  logo_text   text default '',
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. USUARIOS (vinculado a auth.users de Supabase)
create table if not exists usuarios (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique references auth.users(id) on delete cascade,
  email       text not null unique,
  nombre      text not null,
  role        rol_usuario not null default 'tecnico',
  empresa_id  uuid references empresas(id) on delete set null,
  creado_por  text default 'Sistema',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. EQUIPOS
create table if not exists equipos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  codigo        text not null,
  nombre        text not null,
  tipo          tipo_equipo not null default 'Otro',
  fabricante    text default '',
  modelo        text default '',
  serie         text default '',
  vida_util     int default null,
  horas_rec     numeric not null check (horas_rec > 0),
  horas_dia     numeric not null check (horas_dia > 0),
  factor        numeric not null default 1.0 check (factor >= 0.1 and factor <= 3.0),
  horas_acum    numeric not null default 0 check (horas_acum >= 0),
  ubicacion     text default '',
  criticidad    criticidad_equipo not null default 'media',
  condiciones   text[] default array['normal'],
  requiere_cal  boolean not null default false,
  cal_frec      int default null,
  cal_ultima    date default null,
  notas         text default '',
  extra         jsonb default '{}',
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(empresa_id, codigo)
);

-- 4. MANTENIMIENTOS
create table if not exists mantenimientos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  equipo_id       uuid not null references equipos(id) on delete cascade,
  equipo_nombre   text not null,
  fecha           date not null,
  tipo            tipo_mantenimiento not null default 'Preventivo',
  descripcion     text not null default '',
  tecnico         text default '',
  costo           numeric default 0 check (costo >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 5. FALLAS
create table if not exists fallas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  equipo_id       uuid not null references equipos(id) on delete cascade,
  equipo_nombre   text not null,
  fecha           date not null,
  descripcion     text not null default '',
  urgencia        urgencia_falla not null default 'media',
  area            text default '',
  reportado_por   text not null,
  rol_reportante  rol_usuario default 'operador',
  estado          estado_falla not null default 'reportada',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 6. ACTIVOS EMPRESARIALES
create table if not exists activos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  codigo          text not null,
  nombre          text not null,
  categoria       categoria_activo not null default 'Otro',
  marca           text default '',
  modelo          text default '',
  serial          text default '',
  estado          estado_activo not null default 'operativo',
  sede            text not null default '',
  area            text default '',
  oficina         text default '',
  responsable     text default '',
  fecha_compra    date default null,
  garantia        date default null,
  proveedor       text default '',
  costo           numeric default 0 check (costo >= 0),
  observaciones   text default '',
  motivo_baja     text default null,
  obs_baja        text default null,
  fecha_baja      date default null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(empresa_id, codigo)
);

-- 7. MOVIMIENTOS DE ACTIVOS
create table if not exists movimientos_activos (
  id                uuid primary key default gen_random_uuid(),
  activo_id         uuid not null references activos(id) on delete cascade,
  sede_anterior     text default '',
  area_anterior     text default '',
  resp_anterior     text default '',
  sede_nueva        text not null,
  area_nueva        text default '',
  oficina_nueva     text default '',
  responsable_nuevo text default '',
  motivo            text default '',
  realizado_por     text not null,
  created_at        timestamptz not null default now()
);

-- 8. HISTORIAL DE ACTIVOS
create table if not exists historial_activos (
  id          uuid primary key default gen_random_uuid(),
  activo_id   uuid not null references activos(id) on delete cascade,
  tipo        text not null check (tipo in ('registro', 'edicion', 'movimiento', 'baja')),
  icono       text default '',
  descripcion text not null default '',
  usuario     text not null,
  created_at  timestamptz not null default now()
);

-- ── ÍNDICES ──
create index if not exists idx_usuarios_empresa on usuarios(empresa_id);
create index if not exists idx_usuarios_auth on usuarios(auth_id);
create index if not exists idx_equipos_empresa on equipos(empresa_id);
create index if not exists idx_mantenimientos_empresa on mantenimientos(empresa_id);
create index if not exists idx_mantenimientos_equipo on mantenimientos(equipo_id);
create index if not exists idx_mantenimientos_fecha on mantenimientos(fecha);
create index if not exists idx_fallas_empresa on fallas(empresa_id);
create index if not exists idx_fallas_equipo on fallas(equipo_id);
create index if not exists idx_fallas_estado on fallas(estado);
create index if not exists idx_activos_empresa on activos(empresa_id);
create index if not exists idx_movimientos_activo on movimientos_activos(activo_id);
create index if not exists idx_historial_activo on historial_activos(activo_id);

-- ── FUNCIÓN: actualizar updated_at ──
create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── TRIGGERS (con DO block para evitar duplicados) ──
do $$ begin
  create trigger trg_empresas_updated_at before update on empresas
    for each row execute function trigger_set_updated_at();
exception when duplicate_object then null;
end $$;
do $$ begin
  create trigger trg_usuarios_updated_at before update on usuarios
    for each row execute function trigger_set_updated_at();
exception when duplicate_object then null;
end $$;
do $$ begin
  create trigger trg_equipos_updated_at before update on equipos
    for each row execute function trigger_set_updated_at();
exception when duplicate_object then null;
end $$;
do $$ begin
  create trigger trg_mantenimientos_updated_at before update on mantenimientos
    for each row execute function trigger_set_updated_at();
exception when duplicate_object then null;
end $$;
do $$ begin
  create trigger trg_fallas_updated_at before update on fallas
    for each row execute function trigger_set_updated_at();
exception when duplicate_object then null;
end $$;
do $$ begin
  create trigger trg_activos_updated_at before update on activos
    for each row execute function trigger_set_updated_at();
exception when duplicate_object then null;
end $$;

-- ── AUTO GENERAR CÓDIGOS ──
create or replace function generar_codigo_equipo()
returns trigger as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo = 'EQ-' || upper(substr(md5(random()::text), 1, 8));
  end if;
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_equipos_codigo before insert on equipos
    for each row execute function generar_codigo_equipo();
exception when duplicate_object then null;
end $$;

-- ── FUNCIÓN: alias para auth trigger ──
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (auth_id, email, nombre, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)), 'tecnico');
  return new;
end;
$$ language plpgsql security definer;

-- ── TRIGGER: nuevo usuario en auth.users -> usuarios ──
do $$ begin
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception when duplicate_object then null;
end $$;

-- ══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════

-- ── Helper: rol del usuario actual ──
create or replace function current_user_role()
returns rol_usuario as $$
  select role from public.usuarios where auth_id = auth.uid();
$$ language sql stable;

-- ── Helper: empresa_id del usuario actual ──
create or replace function current_user_empresa_id()
returns uuid as $$
  select empresa_id from public.usuarios where auth_id = auth.uid();
$$ language sql stable;

-- ── Helper: el usuario es superadmin ──
create or replace function is_superadmin()
returns boolean as $$
  select current_user_role() = 'superadmin';
$$ language sql stable;

-- ── Helper: el usuario es admin o superadmin ──
create or replace function is_admin_or_super()
returns boolean as $$
  select current_user_role() in ('admin', 'superadmin');
$$ language sql stable;

-- ══ EMPRESAS ══
alter table empresas enable row level security;

create policy "superadmin puede todo en empresas"
  on empresas for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "usuarios pueden ver su empresa"
  on empresas for select
  using (id = current_user_empresa_id());

-- ══ USUARIOS ══
alter table usuarios enable row level security;

create policy "superadmin puede todo en usuarios"
  on usuarios for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "admin puede ver/crear usuarios de su empresa"
  on usuarios for select
  using (is_admin_or_super() and (empresa_id = current_user_empresa_id() or current_user_role() = 'superadmin'));

create policy "admin puede insertar en su empresa"
  on usuarios for insert
  with check (is_admin_or_super() and (empresa_id = current_user_empresa_id() or current_user_role() = 'superadmin'));

create policy "admin puede actualizar en su empresa"
  on usuarios for update
  using (is_admin_or_super() and (empresa_id = current_user_empresa_id() or current_user_role() = 'superadmin'))
  with check (is_admin_or_super() and (empresa_id = current_user_empresa_id() or current_user_role() = 'superadmin'));

create policy "admin puede eliminar en su empresa"
  on usuarios for delete
  using (is_admin_or_super() and (empresa_id = current_user_empresa_id() or current_user_role() = 'superadmin'));

create policy "usuarios pueden ver su propio perfil"
  on usuarios for select
  using (auth_id = auth.uid());

-- ══ EQUIPOS ══
alter table equipos enable row level security;

create policy "superadmin puede todo en equipos"
  on equipos for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "admin y tecnico pueden CRUD equipos de su empresa"
  on equipos for all
  using (empresa_id = current_user_empresa_id() and current_user_role() in ('admin', 'tecnico', 'superadmin'))
  with check (empresa_id = current_user_empresa_id() and current_user_role() in ('admin', 'tecnico', 'superadmin'));

create policy "operador puede ver equipos de su empresa"
  on equipos for select
  using (empresa_id = current_user_empresa_id());

-- ══ MANTENIMIENTOS ══
alter table mantenimientos enable row level security;

create policy "superadmin puede todo en mantenimientos"
  on mantenimientos for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "admin y tecnico pueden CRUD mantenimientos"
  on mantenimientos for all
  using (empresa_id = current_user_empresa_id() and current_user_role() in ('admin', 'tecnico', 'superadmin'))
  with check (empresa_id = current_user_empresa_id() and current_user_role() in ('admin', 'tecnico', 'superadmin'));

-- ══ FALLAS ══
alter table fallas enable row level security;

create policy "superadmin puede todo en fallas"
  on fallas for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "todos los roles pueden insertar fallas"
  on fallas for insert
  with check (empresa_id = current_user_empresa_id());

create policy "admin y tecnico pueden gestionar fallas"
  on fallas for all
  using (empresa_id = current_user_empresa_id() and current_user_role() in ('admin', 'tecnico', 'superadmin'))
  with check (empresa_id = current_user_empresa_id() and current_user_role() in ('admin', 'tecnico', 'superadmin'));

create policy "operador puede ver sus fallas"
  on fallas for select
  using (empresa_id = current_user_empresa_id() and reportado_por = (select nombre from public.usuarios where auth_id = auth.uid()));

-- ══ ACTIVOS ══
alter table activos enable row level security;

create policy "superadmin puede todo en activos"
  on activos for all
  using (is_superadmin())
  with check (is_superadmin());

create policy "usuarios de empresa tipo activos pueden gestionar activos"
  on activos for all
  using (empresa_id = current_user_empresa_id())
  with check (empresa_id = current_user_empresa_id());

-- ══ MOVIMIENTOS E HISTORIAL (heredan permiso del activo padre) ══
alter table movimientos_activos enable row level security;
alter table historial_activos enable row level security;

create policy "acceso via activo padre"
  on movimientos_activos for all
  using (
    exists (
      select 1 from activos
      where activos.id = movimientos_activos.activo_id
      and (is_superadmin() or activos.empresa_id = current_user_empresa_id())
    )
  )
  with check (
    exists (
      select 1 from activos
      where activos.id = movimientos_activos.activo_id
      and (is_superadmin() or activos.empresa_id = current_user_empresa_id())
    )
  );

create policy "acceso via activo padre (historial)"
  on historial_activos for all
  using (
    exists (
      select 1 from activos
      where activos.id = historial_activos.activo_id
      and (is_superadmin() or activos.empresa_id = current_user_empresa_id())
    )
  )
  with check (
    exists (
      select 1 from activos
      where activos.id = historial_activos.activo_id
      and (is_superadmin() or activos.empresa_id = current_user_empresa_id())
    )
  );

-- ══════════════════════════════════════════════════════════
--  VISTAS ÚTILES
-- ══════════════════════════════════════════════════════════

-- Vista: salud del equipo (cálculo core)
create or replace view v_equipo_salud as
select
  e.*,
  round((e.horas_acum * e.factor)::numeric, 2) as horas_ajustadas,
  round(greatest(0, e.horas_rec - (e.horas_acum * e.factor))::numeric, 2) as vida_restante,
  round(greatest(0, (e.horas_rec - (e.horas_acum * e.factor)) / nullif(e.horas_dia, 0))::numeric, 1) as dias_mantenimiento,
  case
    when (e.horas_acum * e.factor) >= e.horas_rec then 0
    else round((1 - ((e.horas_acum * e.factor) / nullif(e.horas_rec, 0))) * 100)
  end as salud_pct,
  case
    when (e.horas_acum * e.factor) >= e.horas_rec then 'crit'
    when (e.horas_acum * e.factor) >= (e.horas_rec * 0.7) then 'warn'
    else 'ok'
  end as estado
from equipos e
where e.activo = true;

-- Vista: próximos mantenimientos
create or replace view v_proximos_mantenimientos as
select
  e.id as equipo_id,
  e.nombre as equipo_nombre,
  e.tipo,
  e.empresa_id,
  e.ubicacion,
  e.criticidad,
  round(greatest(0, (e.horas_rec - (e.horas_acum * e.factor)) / nullif(e.horas_dia, 1))::numeric, 1) as dias_restantes,
  round((e.horas_acum * e.factor)::numeric, 2) as horas_ajustadas,
  e.horas_rec,
  case
    when (e.horas_acum * e.factor) >= e.horas_rec then 'crit'
    when (e.horas_acum * e.factor) >= (e.horas_rec * 0.7) then 'warn'
    else 'ok'
  end as estado
from equipos e
where e.activo = true
order by dias_restantes asc;

-- Vista: resumen por empresa
create or replace view v_resumen_empresa as
select
  emp.id as empresa_id,
  emp.nombre as empresa_nombre,
  emp.tipo,
  count(distinct eq.id) filter (where eq.activo) as total_equipos,
  count(distinct eq.id) filter (where eq.activo and (eq.horas_acum * eq.factor) >= eq.horas_rec) as criticos,
  count(distinct eq.id) filter (where eq.activo and (eq.horas_acum * eq.factor) >= (eq.horas_rec * 0.7) and (eq.horas_acum * eq.factor) < eq.horas_rec) as advertencia,
  count(distinct eq.id) filter (where eq.activo and (eq.horas_acum * eq.factor) < (eq.horas_rec * 0.7)) as ok,
  count(distinct u.id) as total_usuarios,
  count(distinct mt.id) as total_mantenimientos,
  count(distinct fl.id) filter (where fl.estado != 'resuelta') as fallas_pendientes
from empresas emp
left join equipos eq on eq.empresa_id = emp.id
left join usuarios u on u.empresa_id = emp.id
left join mantenimientos mt on mt.empresa_id = emp.id
left join fallas fl on fl.empresa_id = emp.id
group by emp.id, emp.nombre, emp.tipo;

-- ══════════════════════════════════════════════════════════
--  SEED DATA
-- ══════════════════════════════════════════════════════════

-- Empresas demo
insert into empresas (id, nombre, nit, tipo, responsable, ciudad, color, logo_text) values
  ('a0000000-0000-0000-0000-000000000001', 'Transportes del Caribe S.A.S',  '900.111.222-1', 'transporte',   'Jorge Ramirez',  'Barranquilla', '#e87820', 'TC'),
  ('a0000000-0000-0000-0000-000000000002', 'Industrias Mecanicas Orozco',   '900.222.333-2', 'industrial',   'Marta Solano',   'Barranquilla', '#3aaa5c', 'IM'),
  ('a0000000-0000-0000-0000-000000000003', 'Constructora Caribe S.A.S',     '800.654.321-0', 'construccion', 'Andres Perez',   'Cartagena',    '#d4960c', 'CC'),
  ('a0000000-0000-0000-0000-000000000004', 'Corporacion Activos Atlantico', '900.444.555-4', 'activos',      'Diana Cortes',   'Barranquilla', '#e87820', 'CA')
on conflict (nit) do nothing;
