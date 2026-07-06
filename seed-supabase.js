// ══════════════════════════════════════════════
//  SIMPOE — Seed de usuarios demo en Supabase Auth
//  Abrí index.html en el navegador, luego pegá esto
//  en la consola (F12) y ejecutalo UNA SOLA VEZ.
// ══════════════════════════════════════════════

const SEED_USERS = [
  { email:'admin@simmp.co',         password:'admin123', nombre:'Super Administrador', role:'superadmin', empresaId:null },
  { email:'admin@transcaribe.co',   password:'admin123', nombre:'Jorge Ramírez',   role:'admin',    empresaId:1 },
  { email:'tecnico@transcaribe.co', password:'tec456',   nombre:'Pedro Martínez',  role:'tecnico',  empresaId:1 },
  { email:'operador@transcaribe.co',password:'op7890',   nombre:'Luisa Cantillo',  role:'operador', empresaId:1 },
  { email:'admin@orozco.co',        password:'admin123', nombre:'Marta Solano',    role:'admin',    empresaId:2 },
  { email:'tecnico@orozco.co',      password:'tec456',   nombre:'Andrés López',    role:'tecnico',  empresaId:2 },
  { email:'operador@orozco.co',     password:'op7890',   nombre:'Diego Vargas',    role:'operador', empresaId:2 },
  { email:'admin@caribesas.co',     password:'admin123', nombre:'Andrés Pérez',    role:'admin',    empresaId:3 },
  { email:'tecnico@caribesas.co',   password:'tec456',   nombre:'Luis Moreno',     role:'tecnico',  empresaId:3 },
  { email:'operador@caribesas.co',  password:'op7890',   nombre:'Carlos Builes',   role:'operador', empresaId:3 },
  { email:'admin@activosatl.co',    password:'admin123', nombre:'Diana Cortés',    role:'admin',    empresaId:4 },
  { email:'tecnico@activosatl.co',  password:'tec456',   nombre:'Ricardo Núñez',   role:'tecnico',  empresaId:4 },
];

(async function seedSupabaseUsers() {
  console.log('🚀 Sembrando usuarios demo en Supabase Auth...\n');

  for (const u of SEED_USERS) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const { data, error } = await sb.auth.signUp({
        email: u.email,
        password: u.password,
        options: {
          data: {
            nombre: u.nombre,
            role: u.role,
            empresa_id: u.empresaId,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`⏭️  ${u.email} — ya existe (skipped)`);
        } else {
          console.log(`❌ ${u.email} — ${error.message}`);
        }
      } else {
        console.log(`✅ ${u.email} / ${u.password} — creado (${u.role})`);

        // Actualizar el registro en la tabla usuarios con role y empresa correctos
        if (data?.user?.id) {
          const { error: upErr } = await sb
            .from('usuarios')
            .update({
              nombre: u.nombre,
              role: u.role,
              empresa_id: u.empresaId,
              creado_por: 'Sistema',
            })
            .eq('auth_id', data.user.id);

          if (upErr) console.log(`   ⚠️  Error al actualizar perfil: ${upErr.message}`);
        }
      }
    } catch (e) {
      console.log(`💥 ${u.email} — ${e.message}`);
    }
  }

  console.log('\n🏁 Seed completado. Recargá la página (F5) y probá con cualquier usuario.');
})();
