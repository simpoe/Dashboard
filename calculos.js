function calcEquipo(eq) {
  // ════════════════════════════════════════════════════════════
  //  MODELO DE SALUD OPERACIONAL — AHP + Weibull + ISO 14224
  //  Saaty (1980) · Nakajima (1988) · ISO 55000:2014
  //
  //  ISO = Σ(wᵢ·xᵢ)×100  —  Modelo aditivo ponderado
  //  Pesos AHP (CR=0.04, matriz 5×5 consistente):
  //    w1=0.32  w2=0.24  w3=0.22  w4=0.14  w5=0.08
  //
  //  JUSTIFICACIÓN DE PESOS (AHP Saaty 1980):
  //  w1=0.32 Vida residual: variable dominante porque determina
  //    directamente el horizonte de operación segura del activo.
  //    Es el fundamento del RCM para priorización (Nowlan 1978).
  //  w2=0.24 PMI-TPM: el ratio preventivo/total es el KPI central
  //    del TPM (Nakajima 1988). Alta prevalencia preventiva indica
  //    estrategia de mantenimiento proactiva y controlada.
  //  w3=0.22 Confiabilidad R(t): mide la probabilidad de operación
  //    sin falla al tiempo t (ISO 14224). Captura el historial de
  //    fallas en su impacto acumulado sobre la confiabilidad.
  //  w4=0.14 Desgaste: curva de degradación física. Complementa x1
  //    porque el desgaste no es lineal (efecto Weibull β>1).
  //  w5=0.08 Disponibilidad: aunque es el KPI más conocido (MIL-
  //    HDBK-338B), en este modelo se complementa con x3, evitando
  //    doble conteo. Peso menor pero significativo.
  // ════════════════════════════════════════════════════════════
  const extra     = eq.extra||{};
  const horasAcum = +eq.horasAcum||0;
  const horasRec  = +eq.horasRec ||1;
  const factor    = +eq.factor   ||1;
  const horasDia  = +eq.horasDia ||8;

  const horasAjustadas    = +(horasAcum*factor).toFixed(1);
  const vidaRestante      = +Math.max(0,horasRec-horasAjustadas).toFixed(1);
  const diasMantenimiento = horasDia>0?+Math.max(0,vidaRestante/horasDia).toFixed(1):0;

  // Historial de mantenimientos del equipo
  const hist     = typeof mantenimientos!=='undefined'?mantenimientos.filter(m=>m.equipoId===eq.id):[];
  const nPrev    = hist.filter(m=>m.tipo==='Preventivo').length;
  const nCorr    = hist.filter(m=>m.tipo==='Correctivo').length;
  const nPred    = hist.filter(m=>m.tipo==='Predictivo').length;
  const histTotal= nPrev+nCorr+nPred;
  const nFallas  = +(extra['nro-fallas']||extra['eq-nro-fallas']||0)||nCorr;
  const tiempoDet= +(extra['tiempo-det']||extra['eq-tiempo-det']||0);

  // ── x1: Vida útil residual (w1=0.32) ──────────────────────
  // x1 = VR / H_rec  ∈ [0,1]
  const x1 = Math.max(0, Math.min(1, vidaRestante/horasRec));

  // ── x2: PMI — Índice de Mantenimiento Preventivo (w2=0.24) ─
  // PMI = (n_prev+n_pred) / n_total  (Nakajima 1988, JIPM)
  // PMI=1 → estrategia 100% preventiva (ideal TPM)
  // PMI=0 → solo mantenimiento reactivo/correctivo (no deseable)
  const x2 = histTotal>0 ? (nPrev+nPred)/histTotal : 1.0;

  // ── x3: Confiabilidad R(t) CORREGIDA (w3=0.22) ────────────
  // PROBLEMA PREVIO: e^(−λ·H) = e^(−n) solo dependía de n_fallas.
  // CORRECCIÓN: usar MTBF como escala temporal real.
  // λ = n_fallas / H_acum  [fallas/hora] — tasa de fallas real
  // R(t) = e^(−λ·MTBF) = e^(−1) = 0.368 en t=MTBF (estándar)
  // Para el modelo: R = e^(−n_fallas/√H_acum) captura degradación
  // acumulada ponderada por raíz del tiempo (suaviza el impacto)
  const lambda = horasAcum>0 ? nFallas/horasAcum : 0;
  // R(t) evaluada en t = horasAjustadas respecto a MTBF estimado
  const MTBF   = nFallas>0 ? horasAcum/nFallas : Math.max(horasAcum,500);
  const x3     = Math.exp(-horasAjustadas/Math.max(1,MTBF));

  // ── x4: Factor de desgaste Weibull (w4=0.14) ─────────────
  // Modelo curva de degradación: x4 = 1 - (H_adj/H_rec)^β
  // β=1.2 → degradación progresiva (desgaste mecánico típico)
  // β>1 = tasa de fallas creciente (zona desgaste curva bañera)
  const usoPct0 = Math.min(1, horasAjustadas/horasRec);
  const beta    = 1.2; // parámetro forma Weibull
  const x4      = Math.max(0, 1-Math.pow(usoPct0, beta));

  // ── x5: Disponibilidad inherente (w5=0.08) ────────────────
  // A = MTBF/(MTBF+MTTR)  (MIL-HDBK-338B, sección 5.2.3)
  const MTTR   = (tiempoDet>0&&nFallas>0) ? tiempoDet/nFallas : 2;
  const x5     = Math.min(1, MTBF/(MTBF+MTTR));

  // ── ISO ponderado (pesos AHP validados CR=0.04) ───────────
  const saludPct = Math.max(0,Math.round((0.32*x1+0.24*x2+0.22*x3+0.14*x4+0.08*x5)*100));

  // Clasificación clínica (ISO 55000 / NFPA 70B):
  // ≥90% Excelente · 70–89% Bueno · 50–69% Atención · <50% Crítico
  const estado = saludPct>=70?'ok':saludPct>=50?'warn':'crit';
  const usoPct = Math.min(100,Math.round(usoPct0*100));

  // ── Índice de Criticidad (IC) — Jones (1995) RCM ─────────
  // IC = 0.30·S + 0.30·Oi + 0.25·F + 0.15·E  (escala 0-100)
  // S=seguridad, Oi=impacto operacional, F=frecuencia, E=económico
  const criticidadTxt = extra['eq-criticidad']||extra.criticidad||eq.criticidad||'';
  const S  = criticidadTxt.includes('Alta')||eq.criticidad==='alta'?5:criticidadTxt.includes('Baja')||eq.criticidad==='baja'?1:3;
  const Oi = saludPct<50?5:saludPct<70?3:1; // impacto operacional derivado de la salud
  const F  = nFallas>=5?5:nFallas>=3?4:nFallas>=1?2:1;
  const E  = MTTR>8?5:MTTR>4?3:1; // impacto económico via MTTR
  const IC = Math.min(100, Math.round((0.30*S+0.30*Oi+0.25*F+0.15*E)/5*100));
  const nivelCriticidad = IC>=70?'alta':IC>=40?'media':'baja';

  // ── COSTOS DE MANTENIMIENTO (ISO 55000 §6.2) ─────────────
  // CAM = Costo Anual de Mantenimiento
  const costoPrev = hist.filter(m=>m.tipo==='Preventivo'||m.tipo==='Predictivo').reduce((s,m)=>s+(+m.costo||0),0);
  const costoCorr = hist.filter(m=>m.tipo==='Correctivo').reduce((s,m)=>s+(+m.costo||0),0);
  const costoTotal= costoPrev+costoCorr;
  // Costo de Indisponibilidad (CI) — basado en horas detenidas
  // Costo/hora estimado: $200.000/h COP (referencia industria colombiana)
  const costoHora   = eq.costoHora||200000;
  const costoIndisp = tiempoDet*costoHora;
  // Ahorro potencial mantenimiento preventivo:
  // Literatura cita 3:1 a 5:1 ratio costo correctivo vs preventivo
  const ratioCC     = 3.5; // ratio conservador (Wireman 2004)
  const ahorroEstim = Math.max(0, nCorr>0 ? costoCorr*(ratioCC-1)/ratioCC : 0);
  // Índice de impacto económico
  const impEcon = costoTotal+costoIndisp;
  const nivelImpEcon = impEcon>5000000?'critico':impEcon>2000000?'alto':impEcon>500000?'medio':'bajo';

  // ── KPIs adicionales ──────────────────────────────────────
  const confiabilidad = Math.max(0,Math.round(x3*100));
  const disponibilidadPct = Math.round(x5*100);
  const IMP = Math.round(x2*100);

  return {
    horasAjustadas,vidaRestante,diasMantenimiento,saludPct,estado,usoPct,
    // Variables AHP
    x1:+x1.toFixed(3),x2:+x2.toFixed(3),x3:+x3.toFixed(3),x4:+x4.toFixed(3),x5:+x5.toFixed(3),
    // KPIs confiabilidad ISO 14224
    lambda:+lambda.toFixed(6),MTBF:+MTBF.toFixed(1),MTTR:+MTTR.toFixed(1),
    confiabilidad,disponibilidadPct,IMP,
    // Índice de Criticidad RCM
    IC,nivelCriticidad,
    // Costos ISO 55000
    costoPrev,costoCorr,costoTotal,costoIndisp,ahorroEstim,nivelImpEcon,
    nPrev,nCorr,nPred,histTotal,nFallas,tiempoDet,
  };
}

function prodCalc(eq){
  const diasOp=eq.horasDia>0?Math.round(eq.horasAcum/eq.horasDia):0;
  const horasDisp=diasOp*24;
  const pct=horasDisp>0?Math.min(100,Math.round((eq.horasAcum/horasDisp)*100)):0;
  return {diasOp,horasDisp,pct};
}

function iaAnalizar(eq) {
  const c     = calcEquipo(eq);
  const hist  = mantenimientos.filter(m=>m.equipoId===eq.id);
  const nCorr = hist.filter(m=>m.tipo==='Correctivo').length;
  const nPrev = hist.filter(m=>m.tipo==='Preventivo').length;
  const prod  = prodCalc(eq);
  const recs  = [];

  // ── Contexto para razonamiento ────────────────────────
  const factorDesc = eq.factor >= 1.5 ? 'muy intensivo' : eq.factor >= 1.2 ? 'intensivo' : eq.factor <= 0.8 ? 'ligero' : 'normal';
  const histTotal  = nCorr + nPrev;
  const pctCorr    = histTotal > 0 ? Math.round(nCorr/histTotal*100) : 0;
  const diasStr    = c.diasMantenimiento <= 0 ? 'vencido' : `en ${c.diasMantenimiento} días`;
  const hrsDesc    = eq.horasAcum > eq.horasRec*0.9 ? 'casi agotadas' : eq.horasAcum > eq.horasRec*0.6 ? 'en nivel medio-alto' : 'dentro del rango seguro';

  // ── Razones del estado de atención ───────────────────
  const razon = [];
  if (c.nFallas > 0) razon.push(`presenta ${c.nFallas} falla(s) registrada(s)`);
  if (eq.horasAcum > eq.horasRec * 0.7) razon.push('ha superado el 70% del ciclo de vida útil');
  if (c.IMP < 50) razon.push(`el PMI es solo ${c.IMP}% (objetivo TPM: ≥80%)`);
  if (c.confiabilidad < 70) razon.push(`la confiabilidad R(t) es ${c.confiabilidad}%`);
  if (razon.length === 0) razon.push('requiere intervención programada');

  // 1 ── Estado de salud con razonamiento ────────────────
  if (c.saludPct <= 30) {
    recs.push({
      nivel:'crit', icono:'🚨',
      tag:`🔴 ISO=${c.saludPct}% Crítico · λ=${c.lambda}/h · R(t)=${c.confiabilidad}%`,
      titulo:`MTBF=${c.MTBF}h · A=${c.disponibilidadPct}% · IC=${c.IC}/100 (${c.nivelCriticidad})`,
      desc:`El Índice de Salud Operacional <strong>${c.saludPct}%</strong> (umbral crítico ISO 55000: <50%) refleja deterioro multidimensional: x₁=${(c.x1*100).toFixed(0)}% vida residual · x₂=${(c.x2*100).toFixed(0)}% PMI-TPM · x₃=${c.confiabilidad}% confiabilidad R(t)=e^(−λt), λ=${c.lambda} fallas/h · Disponibilidad A=${c.disponibilidadPct}% (MTBF=${c.MTBF}h/MTTR=${c.MTTR}h). ${c.nFallas>0?`Con ${c.nFallas} fallas registradas y PMI=${c.IMP}%, la estrategia es predominantemente correctiva (objetivo TPM: PMI≥80%).`:'Sin fallas registradas pero vida útil comprometida.'} Costo de indisponibilidad acumulado: $${c.costoIndisp.toLocaleString()} COP. Intervención urgente requerida.`,
      base:`λ=${c.lambda}/h · MTBF=${c.MTBF}h · MTTR=${c.MTTR}h · IC=${c.IC}/100 · CAM=$${c.costoTotal.toLocaleString()} · CI=$${c.costoIndisp.toLocaleString()} COP`
    });
  } else if (c.saludPct <= 60) {
    recs.push({
      nivel:'warn', icono:'⚠️',
      tag:`⚠️ ISO=${c.saludPct}% Zona Atención · PMI=${c.IMP}% · MTBF=${c.MTBF}h`,
      titulo:`Programar intervención — R(t)=${c.confiabilidad}% · A=${c.disponibilidadPct}%`,
      desc:`El equipo ha consumido el <strong>${c.usoPct}% de su ciclo de vida útil</strong>${razon.length ? ` ya que ${razon.join(' y ')}` : ''}. Quedan aproximadamente <strong>${c.vidaRestante}h</strong> antes de alcanzar el límite recomendado por el fabricante.`,
      base:`Salud ${c.saludPct}% · Vida restante ${c.vidaRestante}h · ${diasStr} para mantenimiento · Hrs/día ${eq.horasDia}h`
    });
  } else {
    recs.push({
      nivel:'ok', icono:'✅',
      tag:'🟢 Operación dentro de parámetros normales',
      titulo:`${eq.nombre} opera en condición óptima`,
      desc:`El equipo mantiene un índice de salud del <strong>${c.saludPct}%</strong>, con <strong>${c.vidaRestante}h</strong> de vida útil disponibles. Las horas acumuladas (${eq.horasAcum}h) se encuentran ${hrsDesc} del ciclo de ${eq.horasRec}h. Continuar con el plan de mantenimiento actual.`,
      base:`Salud ${c.saludPct}% · Vida restante ${c.vidaRestante}h · Factor ${eq.factor}x · ${diasStr} para mantenimiento`
    });
  }

  // 2 ── Factor de uso intensivo ──────────────────────────
  if (eq.factor >= 1.5) {
    const reduccion = Math.round(eq.horasRec / eq.factor);
    recs.push({
      nivel:'warn', icono:'⚡',
      tag:'⚠️ Uso intensivo — reducir intervalo de mantenimiento',
      titulo:'El desgaste ocurre más rápido que el ciclo base',
      desc:`Con un factor de uso <strong>${eq.factor}x</strong>, el equipo experimenta un desgaste <strong>${Math.round((eq.factor-1)*100)}% más rápido</strong> que en condiciones normales. Esto significa que aunque el fabricante recomienda mantenimiento cada ${eq.horasRec}h físicas, el ciclo efectivo real es de aproximadamente <strong>${reduccion}h</strong>. Se recomienda reducir el intervalo preventivo en un ${Math.round((1-1/eq.factor)*100)}%.`,
      base:`Factor ${eq.factor}x · Hrs físicas ${eq.horasAcum}h · Hrs ajustadas ${c.horasAjustadas}h · Ciclo efectivo recomendado ~${reduccion}h`
    });
  }

  // 3 ── Patrón correctivo dominante ─────────────────────
  if (nCorr > nPrev && histTotal > 1) {
    const costEst = nCorr * 250000;
    const ahorro  = Math.round(costEst * (1 - 1/3.2));
    recs.push({
      nivel:'crit', icono:'💸',
      tag:'🔴 Patrón reactivo detectado — implementar preventivo',
      titulo:`${pctCorr}% de intervenciones son correctivas`,
      desc:`El historial muestra <strong>${nCorr} mantenimiento${nCorr>1?'s':''} correctivo${nCorr>1?'s':''}</strong> frente a <strong>${nPrev} preventivo${nPrev!==1?'s':''}</strong>. Este patrón reactivo indica que el equipo solo recibe atención cuando ya ha fallado, lo cual es en promedio <strong>3.2 veces más costoso</strong> que un mantenimiento preventivo equivalente. Establecer un plan preventivo estructurado podría reducir los costos de mantenimiento de este equipo significativamente.`,
      base:`${nCorr} correctivos · ${nPrev} preventivos · ${pctCorr}% tasa correctiva · Factor costo 3.2×`
    });
  }

  // 4 ── Baja productividad ──────────────────────────────
  if (prod.pct < 40 && eq.horasAcum > 50) {
    recs.push({
      nivel:'info', icono:'📉',
      tag:'ℹ️ Baja productividad — optimizar programación',
      titulo:`El equipo aprovecha solo el ${prod.pct}% de su capacidad disponible`,
      desc:`Con <strong>${eq.horasAcum}h operativas</strong> de <strong>${prod.horasDisp}h disponibles</strong> (${prod.diasOp} días × 24h), el equipo opera muy por debajo de su potencial. Esto puede deberse a paradas no programadas, tiempos de espera, o una programación de turnos ineficiente. Revisar el plan operativo puede incrementar significativamente el retorno sobre la inversión del equipo.`,
      base:`${eq.horasAcum}h operativas / ${prod.horasDisp}h disponibles = ${prod.pct}% productividad · ${prod.diasOp} días operando`
    });
  }

  // 5 ── Alerta de días próximos ─────────────────────────
  if (c.diasMantenimiento > 0 && c.diasMantenimiento <= 7 && c.saludPct > 30) {
    recs.push({
      nivel:'warn', icono:'📅',
      tag:'⚠️ Ventana de mantenimiento próxima',
      titulo:`Mantenimiento recomendado en ${c.diasMantenimiento} día${c.diasMantenimiento>1?'s':''}`,
      desc:`Con un ritmo de operación de <strong>${eq.horasDia}h por día</strong>, el equipo alcanzará su límite de <strong>${eq.horasRec}h</strong> en aproximadamente <strong>${c.diasMantenimiento} día${c.diasMantenimiento>1?'s':''}</strong>. Programar la intervención preventiva ahora evita paros no planificados y garantiza la continuidad operativa.`,
      base:`Vida restante ${c.vidaRestante}h ÷ ${eq.horasDia}h/día = ${c.diasMantenimiento}d · Salud actual ${c.saludPct}%`
    });
  }

  // 6 ── Alertas específicas del sector ─────────────────
  const tipo = getTipoEmpresa();
  const sectorCfg = SECTOR_CONFIG[tipo];
  if (sectorCfg && eq.extra) {

    // ── TRANSPORTE ─────────────────────────────────────
    if (tipo === 'transporte') {
      if (eq.extra.frenos === 'Crítico') {
        recs.push({nivel:'crit',icono:'🛑',tag:'🔴 Frenos críticos — retirar de circulación',
          titulo:'Sistema de frenos requiere intervención inmediata',
          desc:`<strong>${eq.nombre}</strong>${eq.extra.placa?' ('+eq.extra.placa+')':''} presenta <strong>frenos en estado crítico</strong>. La operación con frenos defectuosos representa riesgo inminente para conductor, pasajeros y terceros. Retiro inmediato de circulación hasta completar la reparación.`,
          base:`Estado frenos: Crítico · Conductor: ${eq.extra.conductor||'N/A'} · Ruta: ${eq.extra.ruta||'N/A'}`});
      }
      if (eq.extra.llantas === 'Cambio urgente') {
        recs.push({nivel:'crit',icono:'🔄',tag:'🔴 Cambio de llantas urgente',
          titulo:'Llantas en estado crítico — riesgo de accidente',
          desc:`Las llantas de <strong>${eq.nombre}</strong> requieren cambio inmediato. Llantas deterioradas aumentan el riesgo de reventones y reducen la capacidad de frenado hasta un 40%.`,
          base:`Estado llantas: ${eq.extra.llantas} · Placa: ${eq.extra.placa||'N/A'}`});
      }
      const docAlerts = sectorCfg.ia.alertaVenc(eq.extra);
      const vencidos = docAlerts.filter(a=>a.nivel==='crit');
      const proxDoc  = docAlerts.filter(a=>a.nivel==='warn');
      if (vencidos.length>0) recs.push({nivel:'crit',icono:'📋',tag:'🔴 Documentos vencidos — vehículo inmovilizable',
        titulo:'Renovar documentación obligatoria urgente',
        desc:`El vehículo presenta <strong>${vencidos.length} documento${vencidos.length>1?'s':''} vencido${vencidos.length>1?'s':''}</strong>: ${vencidos.map(a=>a.texto).join(' · ')}. Circulación sujeta a inmovilización y multas por autoridades de tránsito.`,
        base:`Placa: ${eq.extra.placa||'N/A'} · Conductor: ${eq.extra.conductor||'N/A'}`});
      else if (proxDoc.length>0) recs.push({nivel:'warn',icono:'📋',tag:'⚠️ Documentos próximos a vencer',
        titulo:'Gestionar renovación de documentación vehicular',
        desc:`El vehículo tiene <strong>${proxDoc.length} documento${proxDoc.length>1?'s':''} próximo${proxDoc.length>1?'s':''} a vencer</strong>: ${proxDoc.map(a=>a.texto).join(' · ')}.`,
        base:`Placa: ${eq.extra.placa||'N/A'}`});
      const kmAct=+(eq.extra.km||0), kmIni=+(eq.extra['km-ini']||0), recorrido=kmAct-kmIni;
      if (recorrido>0) {
        (sectorCfg.mantenimientoKm||[]).forEach(m=>{
          const pct=Math.round((recorrido/m.cadaKm)*100);
          const restKm=m.cadaKm-recorrido;
          if(pct>=100) recs.push({nivel:'crit',icono:'🔧',tag:`🔴 ${m.tipo} — kilometraje superado`,
            titulo:`${m.tipo} vencido por kilometraje`,
            desc:`El vehículo ha recorrido <strong>${recorrido.toLocaleString()} km</strong> desde el último servicio, superando el intervalo recomendado de <strong>${m.cadaKm.toLocaleString()} km</strong>. Programar servicio inmediatamente.`,
            base:`Km actual: ${kmAct.toLocaleString()} · Recorrido: ${recorrido.toLocaleString()} km · Límite: ${m.cadaKm.toLocaleString()} km`});
          else if(pct>=80) recs.push({nivel:'warn',icono:'⏱',tag:`⚠️ ${m.tipo} — próximo en ${Math.max(0,restKm).toLocaleString()} km`,
            titulo:`Programar ${m.tipo} preventivo`,
            desc:`Faltan <strong>${Math.max(0,restKm).toLocaleString()} km</strong> para el próximo <strong>${m.tipo.toLowerCase()}</strong> (cada ${m.cadaKm.toLocaleString()} km). Programar el servicio con anticipación.`,
            base:`Recorrido: ${recorrido.toLocaleString()} km · Completado: ${pct}%`});
        });
      }
    }

    // ── INDUSTRIAL ──────────────────────────────────────
    else if (tipo === 'industrial') {
      const mia = calcularMantenimientoIAIndustrial(eq);
      // Anomalías → recomendaciones
      mia.anomalias.forEach(a => {
        recs.push({
          nivel: a.tipo==='crit'?'crit':'warn',
          icono: a.icono,
          tag: a.tipo==='crit'?`🔴 Anomalía crítica detectada`:`⚠️ Variable en alerta`,
          titulo: a.msg.split('.')[0],
          desc: a.msg,
          base: `Factor IA: ${mia.factorComb.toFixed(2)}× · Condición: ${mia.condTrab} · Criticidad: ${mia.criticidad.split('—')[0].trim()}`
        });
      });
      // Mantenimientos vencidos / críticos del plan IA
      mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').forEach(m=>{
        recs.push({
          nivel: m.urgencia==='vencido'?'crit':'warn',
          icono: m.icono,
          tag: `${m.urgencia==='vencido'?'🔴':'⚠️'} ${m.nombre} — ${m.urgencia==='vencido'?'VENCIDO':'Crítico'}`,
          titulo: `Programar ${m.nombre} urgentemente`,
          desc: `El equipo ha operado <strong>${mia.horasOp.toLocaleString()}h</strong> desde el último servicio, ${m.urgencia==='vencido'?'superando':'alcanzando el '+m.pctCompletado+'% de'} el intervalo de <strong>${m.intervaloReal.toLocaleString()}h</strong> calculado por la IA (factor ${m.factorAplicado.toFixed(2)}×). ${m.urgencia==='vencido'?'Realizar intervención inmediata para evitar falla.':'Programar servicio en los próximos días.'}`,
          base: `Horas op: ${mia.horasOp.toLocaleString()}h · Intervalo IA: ${m.intervaloReal.toLocaleString()}h · Completado: ${m.pctCompletado}% · Factor: ${mia.factorComb.toFixed(2)}×`
        });
      });
      // Próximos del plan IA (solo si no hay cosas más urgentes)
      if (recs.length === 0) {
        mia.plan.filter(m=>m.urgencia==='proximo').slice(0,2).forEach(m=>{
          recs.push({
            nivel:'warn', icono:m.icono,
            tag:`⚠️ ${m.nombre} — Próximo en ${m.horasRestantes}h`,
            titulo:`Programar ${m.nombre} preventivo`,
            desc:`Faltan <strong>${m.horasRestantes.toLocaleString()}h</strong> para el próximo <strong>${m.nombre.toLowerCase()}</strong> según el plan IA (intervalo calculado: ${m.intervaloReal.toLocaleString()}h). Programar con anticipación.`,
            base:`Horas op: ${mia.horasOp.toLocaleString()}h · Intervalo IA: ${m.intervaloReal.toLocaleString()}h · Completado: ${m.pctCompletado}%`
          });
        });
      }
    }

    // ── CONSTRUCCIÓN ────────────────────────────────────
    else if (tipo === 'construccion') {
      const mia      = calcularMantenimientoIAConstruccion(eq);
      const operador = mia.operador;

      // Alertas críticas del motor IA
      mia.alertas.forEach(a => {
        recs.push({nivel:a.tipo,icono:a.icono,
          tag:a.tipo==='crit'?'🔴 Alerta crítica de maquinaria pesada':'⚠️ Alerta de mantenimiento preventivo',
          titulo:a.msg.split('.')[0],
          desc:a.msg,
          base:`Operador: ${operador} · Obra: ${mia.ubObra} · Proyecto: ${mia.proyecto} · Factor IA: ${mia.factorComb.toFixed(2)}×`});
      });

      // Mantenimientos urgentes IA
      mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').forEach(m=>{
        recs.push({nivel:m.urgencia==='vencido'?'crit':'warn',icono:m.icono,
          tag:`${m.urgencia==='vencido'?'🔴':'⚠️'} ${m.nombre} — ${m.urgencia==='vencido'?'horas superadas':m.horasRestantes+'h restantes'}`,
          titulo:`Programar ${m.nombre} (intervalo IA: ${m.intervaloReal.toLocaleString()}h)`,
          desc:`La maquinaria ha operado <strong>${mia.horasOp.toLocaleString()}h</strong> desde el último servicio. Con el nivel de exigencia <em>${mia.nivel.split('—')[0].trim()}</em> y turnos de ${mia.turno}, el intervalo real es <strong>${m.intervaloReal.toLocaleString()}h</strong> (factor ${mia.factorComb.toFixed(2)}×). ${m.urgencia==='vencido'?'Programar servicio inmediatamente.':'Planificar en los próximos días.'}`,
          base:`Horas operadas: ${mia.horasOp.toLocaleString()}h · Intervalo IA: ${m.intervaloReal.toLocaleString()}h · Avance: ${m.pctCompletado}% · Operador: ${operador}`});
      });

      // Próximos mantenimientos
      mia.plan.filter(m=>m.urgencia==='proximo').slice(0,2).forEach(m=>{
        recs.push({nivel:'warn',icono:m.icono,
          tag:`⚠️ ${m.nombre} — próximo en ${m.horasRestantes.toLocaleString()}h`,
          titulo:`Planificar ${m.nombre} preventivo`,
          desc:`Faltan <strong>${m.horasRestantes.toLocaleString()}h</strong> para el próximo <strong>${m.nombre.toLowerCase()}</strong>. Con el nivel de exigencia de la obra, el plan IA recomienda programar este servicio con anticipación.`,
          base:`Intervalo IA: ${m.intervaloReal.toLocaleString()}h · Factor: ${mia.factorComb.toFixed(2)}× · Avance: ${m.pctCompletado}%`});
      });

      // Riesgo general si es crítico y sin alertas específicas
      if(mia.nivelRiesgo==='critico'&&mia.alertas.length===0) {
        recs.push({nivel:'crit',icono:'🎯',
          tag:'🔴 Índice de riesgo crítico — inspección requerida',
          titulo:`Riesgo operacional crítico: ${mia.riesgo}/100`,
          desc:`La combinación de factores — nivel de exigencia (${mia.nivel.split('—')[0].trim()}), turno de operación (${mia.turno}), desgaste estructural y ${mia.nFallas} fallas recientes — genera un índice de riesgo de <strong>${mia.riesgo}/100</strong>. Inspección técnica integral recomendada.`,
          base:`Factor IA: ${mia.factorComb.toFixed(2)}× · Riesgo: ${mia.riesgo}/100 · Operador: ${operador}`});
      }
    }
  }

  // 7 ── Calibración vencida ─────────────────────────────
  if (eq.calReq === 'si' && eq.calUltima && eq.calFrec) {
    const diasDesde = Math.round((Date.now() - new Date(eq.calUltima)) / 864e5);
    if (diasDesde > eq.calFrec) {
      const diasVencida = diasDesde - eq.calFrec;
      recs.push({
        nivel:'warn', icono:'🧪',
        tag:'⚠️ Calibración vencida — precisión comprometida',
        titulo:`Calibración con ${diasVencida} días de vencimiento`,
        desc:`La última calibración registrada fue el <strong>${new Date(eq.calUltima).toLocaleDateString('es-CO')}</strong> (hace ${diasDesde} días). La frecuencia establecida es de <strong>cada ${eq.calFrec} días</strong>, por lo que lleva <strong>${diasVencida} días sin calibrar</strong>. Un equipo descalibrado puede generar mediciones erróneas y decisiones operativas incorrectas.`,
        base:`Última calibración: ${eq.calUltima} · Frecuencia: ${eq.calFrec}d · Días desde calibración: ${diasDesde}d`
      });
    }
  }

  return { c, hist, nCorr, nPrev, prod, recs };
}

function getFactorAnio(anio){
  const edad=new Date().getFullYear()-(+anio||2015);
  return edad>10?0.65:edad>7?0.75:edad>4?0.85:1.0;
}

function getFactorMotor(motor){
  if(!motor) return 1.0;
  const m=motor.toLowerCase();
  if(m.includes('euro 6')||m.includes('euro vi')) return 1.1;
  if(m.includes('euro 3')||m.includes('euro iii')) return 0.8;
  return 1.0;
}

function calcularMantenimientoIA(eq) {
  // Modelo RCM Vehicular — SAE JA1011 / Nowlan & Heap (1978)
  // f_adj=f_cond·f_anio·f_motor  I_real=I_base·f_adj
  // f_anio=max(0.65,1−(edad/20)^0.5)  [degradación no lineal]
  const extra    = eq.extra||{};
  const kmAct    = +(extra.km||0);
  const kmIni    = +(extra['km-ini']||0);
  const recorrido= Math.max(0,kmAct-kmIni);
  const condOp   = extra['cond-op']||'Normal';
  const anio     = +(extra.anio||extra['eq-anio']||new Date().getFullYear()-5);
  const motor    = extra['motor-tipo']||'';

  const factorCond = FACTOR_COND_OP[condOp]||1.0;
  const edad = new Date().getFullYear()-anio;
  // Factor por antigüedad — degradación con raíz cuadrada (no lineal)
  const factorAnio = Math.max(0.65,Math.min(1.0,1-Math.pow(edad/20,0.5)));
  const factorMotor = getFactorMotor(motor);
  const factorComb = +(factorCond*factorAnio*factorMotor).toFixed(3);

  const plan = MANT_INTERVALOS_BASE.map(m=>{
    let intervalo = Math.max(500,Math.round(m.kmBase*factorComb));
    const estadoFrenos=extra.frenos||'Óptimo';
    const estadoLlantas=extra.llantas||'Buen estado';
    if(m.id==='frenos'&&estadoFrenos!=='Óptimo') intervalo=Math.round(intervalo*0.70);
    if(m.id==='llantas'&&estadoLlantas!=='Buen estado') intervalo=Math.round(intervalo*0.60);
    const kmEnInt = recorrido>0?recorrido%intervalo:0;
    const kmRest  = recorrido>0?Math.max(0,intervalo-kmEnInt):intervalo;
    const pctComp = recorrido>0?Math.min(100,Math.round((kmEnInt/intervalo)*100)):0;
    const urgencia= pctComp>=100?'vencido':pctComp>=90?'critico':pctComp>=75?'proximo':'ok';
    return {...m,intervaloReal:intervalo,kmRestantes:kmRest,pctCompletado:pctComp,urgencia,factorAplicado:factorComb};
  });

  const hoy = new Date();
  const docs = [
    {id:'soat',nombre:'SOAT',valor:extra.soat},
    {id:'tecno',nombre:'Tecnomecánica',valor:extra.tecno},
    {id:'poliza',nombre:'Póliza de Seguros',valor:extra.poliza},
    {id:'tarj-op',nombre:'Tarjeta de Operación',valor:extra['tarj-op']},
    {id:'lic-cond',nombre:'Licencia Conductor',valor:extra['lic-cond']},
    {id:'seguro-extra',nombre:'Seguro Adicional',valor:extra['seguro-extra']},
  ].map(d=>{
    if(!d.valor) return {...d,estado:'no_registrado',diasRestantes:null};
    const diff=Math.round((new Date(d.valor)-hoy)/864e5);
    return {...d,diasRestantes:diff,fechaVenc:d.valor,
      estado:diff<0?'vencido':diff<=7?'critico':diff<=30?'proximo':'vigente'};
  });

  return {plan,docs,recorrido,kmAct,condOp,anio,motor,factorComb,edad,factorAnio,factorCond,factorMotor};
}

function calcularMantenimientoIAConstruccion(eq) {
  // Modelo RCM Maquinaria Pesada — SAE JA1011 / ISO 55000
  // f_adj=f_nivel·f_turno·f_desg·e^(−0.18·n_fallas)
  // IRO_hid = riesgo hidráulico-estructural (escala FMEA simplificada)
  const extra     = eq.extra||{};
  const hMaq      = +(extra['horas-maq']||extra['eq-horas-maq']||eq.horasAcum||0);
  const hIni      = +(extra['horas-maq-ini']||extra['eq-horas-maq-ini']||0);
  const horasOp   = Math.max(0,hMaq-hIni);
  const nivel     = extra['nivel-trabajo']||extra['eq-nivel-trabajo']||'Normal — Terreno plano';
  const turno     = extra.turno||extra['eq-turno']||'1 turno (8h/día)';
  const desg      = extra['desg-estruc']||extra['eq-desg-estruc']||'Sin daños — Óptimo';
  const estadoHid = extra['estado-hid']||extra['eq-estado-hid']||'Óptimo';
  const presHid   = +(extra['presion-hid']||extra['eq-presion-hid']||0);
  const presMax   = +(extra['pres-max']||extra['eq-pres-max']||250);
  const temp      = +(extra.temperatura||extra['eq-temperatura']||0);
  const nFallas   = +(extra['nro-fallas']||extra['eq-nro-fallas']||0);
  const tipoMaq   = extra['tipo-maq']||extra['eq-tipo-maq']||'';
  const operador  = extra.operador||extra['eq-operador']||'N/A';
  const ubObra    = extra['ub-obra']||extra['eq-ub-obra']||'N/A';
  const proyecto  = extra.proyecto||extra['eq-proyecto']||'N/A';

  // Factores RCM: penalizan exigencia, turnos, desgaste, fallas
  const factorNivel  = FACTOR_NIVEL_TRABAJO[nivel]||1.0;
  const factorTurno  = FACTOR_TURNO_CONST[turno]||1.0;
  const factorDesg   = desg.startsWith('Daño')?0.55:desg.startsWith('moderado')?0.70:desg.startsWith('leve')?0.85:1.0;
  // Penalización exponencial por fallas λ=0.18 (más agresiva que industrial por criticidad de obra)
  const factorFallas = Math.exp(-0.18*nFallas);
  const factorComb   = +(Math.min(factorNivel,factorTurno)*factorDesg*factorFallas).toFixed(3);

  // KPIs ISO 14224 adaptados a maquinaria pesada
  const MTBF_c = horasOp>0&&nFallas>0?horasOp/nFallas:Math.max(horasOp,800);
  const MTTR_c = nFallas>0?(8*nFallas)/nFallas:4; // estimación 8h/reparación típica obra
  const disp_c = MTBF_c/(MTBF_c+MTTR_c);
  const R_c    = Math.exp(-horasOp/Math.max(1,MTBF_c));

  // Índice de Riesgo Hidráulico-Estructural (escala FMEA 0-100)
  let IRO = 0;
  if(estadoHid==='Falla hidráulica')    IRO += 9*9*5;       // S×O×D crítico
  else if(estadoHid==='Fuga detectada') IRO += 9*7*5;
  else if(estadoHid==='Requiere revisión') IRO += 6*4*5;
  if(presHid>0&&presMax>0){
    const ratioP = presHid/presMax;
    if(ratioP>0.90) IRO += 8*8*4;
    else if(ratioP>0.80) IRO += 8*5*4;
  }
  if(desg.startsWith('Daño')) IRO += 9*8*6;
  else if(desg.startsWith('moderado')) IRO += 7*5*6;
  if(temp>105) IRO += 7*8*4;
  else if(temp>90) IRO += 7*4*4;
  if(nFallas>=3) IRO += 6*Math.min(9,nFallas)*3;
  const IRO_max = 9*9*5 + 8*8*4 + 9*8*6 + 7*8*4 + 6*9*3; // = 405+256+432+224+162 = 1479
  const riesgo  = Math.min(100,Math.round((IRO/IRO_max)*100));
  const nivelRiesgo = riesgo>=70?'critico':riesgo>=45?'alto':riesgo>=20?'medio':'bajo';

  const cfg = SECTOR_CONFIG['construccion'];
  const plan = (cfg.mantenimientoHoras||[]).map(m=>{
    const intervalo = Math.max(100,Math.round(m.cadaHoras*factorComb));
    const hRest = horasOp>0?Math.max(0,intervalo-(horasOp%intervalo)):intervalo;
    const pctComp = horasOp>0?Math.min(100,Math.round(((horasOp%intervalo)/intervalo)*100)):0;
    const urgencia = pctComp>=100?'vencido':pctComp>=90?'critico':pctComp>=75?'proximo':'ok';
    return {...m,intervaloReal:intervalo,horasRestantes:hRest,pctCompletado:pctComp,urgencia,factorAplicado:factorComb};
  });

  const alertas=[];
  if(estadoHid==='Falla hidráulica')     alertas.push({tipo:'crit',icono:'💧',msg:`Falla hidráulica activa en ${tipoMaq||'la maquinaria'}. RPN=${9*9*5}. Paralizar inmediatamente.`});
  else if(estadoHid==='Fuga detectada')  alertas.push({tipo:'crit',icono:'💧',msg:`Fuga hidráulica detectada. RPN=${9*7*5}. Riesgo de pérdida de presión. Detener y reparar.`});
  else if(estadoHid==='Requiere revisión') alertas.push({tipo:'warn',icono:'💧',msg:`Sistema hidráulico requiere revisión preventiva. Programar inspección técnica.`});
  if(presHid>0&&presMax>0&&presHid>presMax*0.90) alertas.push({tipo:'crit',icono:'🔴',msg:`Presión crítica: ${presHid} bar de ${presMax} bar máx (${Math.round(presHid/presMax*100)}%). Riesgo de ruptura de mangueras/sellos.`});
  if(desg.startsWith('Daño'))   alertas.push({tipo:'crit',icono:'🏗️',msg:`Daño estructural detectado${ubObra!=='N/A'?' en '+ubObra:''}. RPN=${9*8*6}. Paralizar hasta inspección certificada.`});
  else if(desg.startsWith('moderado')) alertas.push({tipo:'warn',icono:'🔩',msg:`Desgaste estructural moderado. Inspección técnica antes de operaciones de alta carga.`});
  if(temp>105) alertas.push({tipo:'crit',icono:'🌡️',msg:`Temperatura motor crítica: ${temp}°C. Sobrecalentamiento severo. Apagar y verificar enfriamiento.`});
  else if(temp>90) alertas.push({tipo:'warn',icono:'🌡️',msg:`Temperatura elevada: ${temp}°C. Verificar nivel de refrigerante.`});
  if(nFallas>=3) alertas.push({tipo:'crit',icono:'⚠️',msg:`${nFallas} fallas en 30 días. MTBF=${MTBF_c.toFixed(0)}h · R(t)=${Math.round(R_c*100)}%. Análisis técnico especializado requerido.`});

  return {plan,alertas,riesgo,nivelRiesgo,factorComb,horasOp,hMaq,nivel,turno,desg,estadoHid,presHid,temp,nFallas,tipoMaq,operador,ubObra,proyecto,
    MTBF:+MTBF_c.toFixed(1),MTTR:+MTTR_c.toFixed(1),disponibilidadPct:Math.round(disp_c*100),confiabilidad:Math.max(0,Math.round(R_c*100))};
}

function calcularMantenimientoIAIndustrial(eq) {
  // FMEA Industrial — IEC 60300-3-11 / MIL-HDBK-338B
  // IRO = Σ(S·O·D)/IRO_max×100  f_adj=f_cond·f_crit·f_deg·e^(−0.15·n)
  // MTBF=h/n_fallas  R(t)=e^(−t/MTBF)  (EN 13306 / ISO 14224)
  const extra     = eq.extra||{};
  const horasAcum = +(extra['horas-acum-ind']||extra['eq-horas-acum-ind']||eq.horasAcum||0);
  const horasUlt  = +(extra['horas-ult-mant']||extra['eq-horas-ult-mant']||0);
  const horasOp   = Math.max(0,horasAcum-horasUlt);
  const condTrab  = extra['cond-trabajo']||extra['eq-cond-trabajo']||'Normal';
  const criticidad= extra['eq-criticidad']||extra.criticidad||'Media — Afecta parcialmente';
  const vibracion = +(extra.vibracion||extra['eq-vibracion']||0);
  const temp      = +(extra.temperatura||extra['eq-temperatura']||0);
  const tempMax   = +(extra['temp-max']||extra['eq-temp-max']||95);
  const desgaste  = extra['desgaste-ind']||extra['eq-desgaste-ind']||'Mínimo — Normal';
  const nFallas   = +(extra['nro-fallas']||extra['eq-nro-fallas']||0);
  const prodPct   = +(extra['prod-pct']||extra['eq-prod-pct']||0);
  const tiempoDet = +(extra['tiempo-det']||extra['eq-tiempo-det']||0);

  const factorCond = FACTOR_COND_TRABAJO[condTrab]||1.0;
  const factorCrit = FACTOR_CRITICIDAD[criticidad]||0.90;
  const factorDeg  = desgaste.startsWith('Crítico')?0.55:desgaste.startsWith('Avanzado')?0.70:desgaste.startsWith('Moderado')?0.85:1.0;
  const factorFail = Math.exp(-0.15*nFallas);
  const factorComb = +(Math.min(factorCond,factorCrit)*factorDeg*factorFail).toFixed(3);

  // KPIs ISO 14224
  // Tasa de fallas λ y confiabilidad — modelo exponencial (β=1 Weibull)
  const MTBF_ind = horasAcum>0&&nFallas>0?horasAcum/nFallas:Math.max(horasAcum,1000);
  const MTTR_ind = tiempoDet>0&&nFallas>0?tiempoDet/nFallas:2;
  const disp_ind = MTBF_ind/(MTBF_ind+MTTR_ind); // Disponibilidad inherente (MIL-HDBK-338B)
  const lambda_ind = 1/MTBF_ind; // tasa de fallas [fallas/hora]
  const R_t      = Math.exp(-lambda_ind*horasOp); // R(t)=e^(-λt)

  // FMEA — Número de Prioridad de Riesgo (RPN = S×O×D)
  const O_vib  = vibracion>7.0?9:vibracion>4.5?6:vibracion>2.5?3:1;
  const O_temp = temp>tempMax?9:temp>tempMax*0.90?6:temp>tempMax*0.75?3:1;
  const O_deg  = desgaste.startsWith('Crítico')?8:desgaste.startsWith('Avanzado')?5:desgaste.startsWith('Moderado')?3:1;
  const O_fail = nFallas>=5?8:nFallas>=3?5:nFallas>=1?3:1;
  const O_prod = prodPct>0&&prodPct<30?7:prodPct>0&&prodPct<50?4:tiempoDet>8?5:1;
  const IRO_raw= 8*O_vib*5 + 9*O_temp*4 + 7*O_deg*6 + 8*O_fail*3 + 5*O_prod*7;
  const riesgo = Math.min(100,Math.round((IRO_raw/1457)*100));
  const nivelRiesgo = riesgo>=70?'critico':riesgo>=45?'alto':riesgo>=20?'medio':'bajo';

  const cfg = SECTOR_CONFIG['industrial'];
  const plan = (cfg.mantenimientoHoras||[]).map(m=>{
    const intervalo = Math.max(100,Math.round(m.cadaHoras*factorComb));
    const hEnInt    = horasOp>0?horasOp%intervalo:0;
    const hRest     = horasOp>0?Math.max(0,intervalo-hEnInt):intervalo;
    const pctComp   = horasOp>0?Math.min(100,Math.round((hEnInt/intervalo)*100)):0;
    const urgencia  = pctComp>=100?'vencido':pctComp>=90?'critico':pctComp>=75?'proximo':'ok';
    return {...m,intervaloReal:intervalo,horasRestantes:hRest,pctCompletado:pctComp,urgencia,factorAplicado:factorComb};
  });

  const anomalias=[];
  if(vibracion>7.0)      anomalias.push({tipo:'crit',icono:'📳',msg:`Vibración crítica: ${vibracion} mm/s (ISO 10816-3 zona D >7.1). RPN=${8*O_vib*5}. Falla estructural inminente.`});
  else if(vibracion>4.5) anomalias.push({tipo:'warn',icono:'📳',msg:`Vibración elevada: ${vibracion} mm/s (ISO 10816-3 zona C >4.5). Inspección de rodamientos recomendada.`});
  if(temp>tempMax)        anomalias.push({tipo:'crit',icono:'🌡️',msg:`Temperatura crítica: ${temp}°C > límite ${tempMax}°C. RPN=${9*O_temp*4}. Detener equipo.`});
  else if(temp>tempMax*0.85) anomalias.push({tipo:'warn',icono:'🌡️',msg:`Temperatura elevada: ${temp}°C (${Math.round(temp/tempMax*100)}% del límite). Verificar refrigeración.`});
  if(tiempoDet>8)        anomalias.push({tipo:'warn',icono:'⏱',msg:`Tiempo muerto: ${tiempoDet}h · D=${Math.round(disp_ind*100)}% · MTBF=${MTBF_ind.toFixed(0)}h · MTTR=${MTTR_ind.toFixed(1)}h.`});
  if(prodPct>0&&prodPct<40) anomalias.push({tipo:'warn',icono:'📉',msg:`Productividad: ${prodPct}% · Disponibilidad estimada D=${Math.round(disp_ind*100)}%.`});
  if(nFallas>=3)         anomalias.push({tipo:'crit',icono:'⚠️',msg:`${nFallas} fallas · MTBF=${MTBF_ind.toFixed(0)}h · R(t)=${Math.round(R_t*100)}% · Análisis FMEA urgente.`});

  return {
    plan,anomalias,riesgo,nivelRiesgo,factorComb,horasOp,horasAcum,
    vibracion,temp,desgaste,nFallas,prodPct,condTrab,criticidad,
    MTBF:+MTBF_ind.toFixed(1),MTTR:+MTTR_ind.toFixed(1),
    disponibilidadPct:Math.round(disp_ind*100),
    confiabilidad:Math.max(0,Math.round(R_t*100)),
    factorCond,factorCrit,factorDeg,factorFail,
  };
}

function iaTooltip(eq) {
  const c = calcEquipo(eq);
  const hist = mantenimientos.filter(m=>m.equipoId===eq.id);
  const nCorr = hist.filter(m=>m.tipo==='Correctivo').length;
  const lines = [];

  if (c.saludPct <= 30) {
    lines.push(`🔴 ${eq.nombre} tiene solo ${c.saludPct}% de salud — intervención urgente.`);
  } else if (c.saludPct <= 60) {
    lines.push(`⚠️ ${eq.nombre} está al ${c.usoPct}% de su ciclo. Próximo mantenimiento en ${c.diasMantenimiento} días.`);
  } else {
    lines.push(`✅ ${eq.nombre} opera normalmente — ${c.saludPct}% de salud.`);
  }
  if (eq.factor >= 1.5) lines.push(`⚡ Factor de uso ${eq.factor}x — ciclo de mantenimiento acelerado.`);
  if (nCorr > 2)        lines.push(`💸 ${nCorr} correctivos registrados — considerar plan preventivo.`);
  if (eq.calReq==='si' && eq.calFrecuencia) {
    const diasCal = eq.calUltima
      ? Math.round((Date.now()-new Date(eq.calUltima))/(864e5))
      : null;
    if (diasCal && diasCal > eq.calFrecuencia)
      lines.push(`🧪 Calibración vencida — última hace ${diasCal} días (frecuencia: ${eq.calFrecuencia}d).`);
  }
  return lines;
}

function getTipoEmpresa() {
  return empresaActual?.tipo || 'industrial';
}

function selTipoEmpresa(tipo) {
  document.getElementById('ne-tipo-empresa').value = tipo;
  const tipos = ['transporte','industrial','construccion','activos'];
  const hints = {
    transporte:  '🚌 Transporte — Formularios adaptados para flotas: placa, kilometraje, SOAT, tecnomecánica, llantas.',
    industrial:  '⚙️ Industrial — Formularios adaptados para maquinaria: horas operación, vibración, temperatura, desgaste.',
    construccion:'🏗️ Construcción — Formularios adaptados para maquinaria pesada: horas máquina, presión hidráulica, operador.'
  };
  tipos.forEach(t => {
    const btn = document.getElementById('tipo-btn-'+t);
    if (!btn) return;
    if (t === tipo) {
      btn.style.borderColor = 'var(--blue)';
      btn.style.background  = 'rgba(14,165,233,.1)';
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.background  = 'var(--s3)';
    }
  });
  const hint = document.getElementById('ne-tipo-hint');
  if (hint) hint.textContent = hints[tipo] || '';
}

function renderCamposExtra() {
  const tipo  = getTipoEmpresa();
  const cfg   = SECTOR_CONFIG[tipo];
  const cont  = document.getElementById('campos-extra-sector');
  if (!cont || !cfg) return;
  if (!cfg.camposExtra || cfg.camposExtra.length === 0) { cont.innerHTML = ''; return; }

  if (tipo === 'transporte') {
    // Render transporte with grouped sections
    const grupos = {
      '🚌 Identificación Vehicular': cfg.camposExtra.slice(0, 6),
      '🛣️ Datos de Operación':        cfg.camposExtra.slice(6, 13),
      '🔧 Estado Mecánico':           cfg.camposExtra.slice(13, 17),
      '📋 Control Documental':        cfg.camposExtra.slice(17),
    };
    cont.innerHTML = Object.entries(grupos).map(([titulo, campos]) => `
      <div class="form-sec-title">${titulo}</div>
      <div class="form-grid" style="margin-bottom:16px">
        ${campos.map(f => `
          <div class="fg">
            <label>${f.label}</label>
            ${f.tipo === 'select'
              ? `<select id="${f.id}">${f.opciones.map(o=>`<option>${o}</option>`).join('')}</select>`
              : `<input type="${f.type||'text'}" id="${f.id}" placeholder="${f.placeholder||''}">`}
            ${f.hint ? `<span class="field-hint">${f.hint}</span>` : ''}
          </div>`).join('')}
      </div>`).join('');
  } else if (tipo === 'construccion') {
    const grupos = {
      '🏗️ Identificación de Maquinaria': cfg.camposExtra.slice(0, 6),
      '⏱ Datos Operacionales':            cfg.camposExtra.slice(6, 12),
      '🔴 Estado Técnico':                cfg.camposExtra.slice(12),
    };
    cont.innerHTML = Object.entries(grupos).map(([titulo, campos]) => `
      <div class="form-sec-title">${titulo}</div>
      <div class="form-grid" style="margin-bottom:16px">
        ${campos.map(f => `
          <div class="fg">
            <label>${f.label}</label>
            ${f.tipo === 'select'
              ? `<select id="${f.id}">${f.opciones.map(o=>`<option>${o}</option>`).join('')}</select>`
              : `<input type="${f.type||'text'}" id="${f.id}" placeholder="${f.placeholder||''}">`}
            ${f.hint ? `<span class="field-hint">${f.hint}</span>` : ''}
          </div>`).join('')}
      </div>`).join('');
  } else if (tipo === 'industrial') {
    const grupos = {
      '⚙️ Identificación Técnica':     cfg.camposExtra.slice(0, 5),
      '📊 Variables Operacionales':     cfg.camposExtra.slice(5, 13),
      '📈 Estado y Métricas':           cfg.camposExtra.slice(13),
    };
    cont.innerHTML = Object.entries(grupos).map(([titulo, campos]) => `
      <div class="form-sec-title">${titulo}</div>
      <div class="form-grid" style="margin-bottom:16px">
        ${campos.map(f => `
          <div class="fg">
            <label>${f.label}</label>
            ${f.tipo === 'select'
              ? `<select id="${f.id}">${f.opciones.map(o=>`<option>${o}</option>`).join('')}</select>`
              : `<input type="${f.type||'text'}" id="${f.id}" placeholder="${f.placeholder||''}">`}
            ${f.hint ? `<span class="field-hint">${f.hint}</span>` : ''}
          </div>`).join('')}
      </div>`).join('');
  } else {
    cont.innerHTML = `
      <div class="form-sec-title">${cfg.icono} Datos específicos — ${cfg.nombre}</div>
      <div class="form-grid" style="margin-bottom:14px">
        ${cfg.camposExtra.map(f => `
          <div class="fg">
            <label>${f.label}</label>
            ${f.tipo === 'select'
              ? `<select id="${f.id}">${f.opciones.map(o=>`<option>${o}</option>`).join('')}</select>`
              : `<input type="${f.type||'text'}" id="${f.id}" placeholder="${f.placeholder||''}">`}
            ${f.hint ? `<span class="field-hint">${f.hint}</span>` : ''}
          </div>`).join('')}
      </div>`;
  }
}

function leerCamposExtra() {
  const tipo = getTipoEmpresa();
  const cfg  = SECTOR_CONFIG[tipo];
  if (!cfg || !cfg.camposExtra) return {};
  const extra = {};
  cfg.camposExtra.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) extra[f.id.replace('eq-','')] = el.value;
  });
  return extra;
}

function getDashboardStats(all) {
  const tipo = getTipoEmpresa();
  const cfg  = SECTOR_CONFIG[tipo]?.dashboard;
  const avgS = all.length ? Math.round(all.reduce((s,x)=>s+x.c.saludPct,0)/all.length) : 0;

  if (tipo === 'transporte') {
    const hoy = new Date();
    let docVenc=0, docProx=0, mantUrg=0, mantProx=0;
    all.forEach(({eq})=>{
      const mia = calcularMantenimientoIA(eq);
      docVenc += mia.docs.filter(d=>d.estado==='vencido').length;
      docProx += mia.docs.filter(d=>d.estado==='critico'||d.estado==='proximo').length;
      mantUrg += mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').length;
      mantProx+= mia.plan.filter(m=>m.urgencia==='proximo').length;
    });
    const ok  = all.filter(x=>x.c.estado==='ok').length;
    const disp= all.length?Math.round(ok/all.length*100):0;
    return [
      {v:all.length, l:'Vehículos Flota',       i:'🚌', sub:`${disp}% disponibilidad`, color:'blue'},
      {v:ok,         l:'En Circulación',         i:'✅', sub:`${all.length-ok} en mantenimiento`, color:'green'},
      {v:docVenc,    l:'Documentos Vencidos',    i:'📋', sub:docProx>0?`+${docProx} próx. a vencer`:'Verificar documentación', color:docVenc>0?'red':'yellow'},
      {v:mantUrg,    l:'Mantenimientos Urgentes',i:'🔧', sub:mantProx>0?`+${mantProx} próximos`:'Plan IA activo', color:mantUrg>0?'red':'green'},
    ];
  }
  if (tipo === 'construccion') {
    let urgMant=0, alertasCrit=0;
    all.forEach(({eq})=>{
      const mia = calcularMantenimientoIAConstruccion(eq);
      urgMant    += mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').length;
      alertasCrit+= mia.alertas.filter(a=>a.tipo==='crit').length;
    });
    const ok   = all.filter(x=>x.c.estado==='ok').length;
    const crits= all.filter(x=>x.c.estado==='crit').length;
    const disp = all.length?Math.round(ok/all.length*100):0;
    const avgS = all.length?Math.round(all.reduce((s,x)=>s+x.c.saludPct,0)/all.length):0;
    return [
      {v:ok,          l:'Maquinaria Activa',    i:'🏗️', sub:`${all.length} total · salud ${avgS}%`,   color:'blue'},
      {v:disp+'%',    l:'Disponibilidad Flota', i:'📊', sub:`${all.length-ok} en mantenimiento`,       color:disp>=70?'green':'yellow'},
      {v:urgMant,     l:'Mant. Urgentes IA',    i:'🔧', sub:`${alertasCrit} alertas críticas`,          color:urgMant>0?'red':'green'},
      {v:crits,       l:'Equipos Críticos',     i:'🔴', sub:'Requieren intervención urgente',           color:crits>0?'red':'green'},
    ];
  }
  if (tipo === 'industrial') {
    let urgMant=0, anomTotal=0;
    all.forEach(({eq})=>{
      const mia=calcularMantenimientoIAIndustrial(eq);
      urgMant  += mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').length;
      anomTotal+= mia.anomalias.length;
    });
    const ok   = all.filter(x=>x.c.estado==='ok').length;
    const crits= all.filter(x=>x.c.estado==='crit').length;
    const avgS = all.length?Math.round(all.reduce((s,x)=>s+x.c.saludPct,0)/all.length):0;
    const disp = all.length?Math.round(ok/all.length*100):0;
    return [
      {v:ok,          l:'Equipos Operativos',    i:'⚙️', sub:`${all.length} en total · salud ${avgS}%`, color:'blue'},
      {v:avgS+'%',    l:'Salud Operacional',      i:'❤️', sub:`${crits} equipos críticos`, color:avgS>=70?'green':avgS>=40?'yellow':'red'},
      {v:urgMant,     l:'Mant. Urgentes IA',      i:'🔧', sub:`${anomTotal} anomalías detectadas`, color:urgMant>0?'red':'green'},
      {v:disp+'%',    l:'Disponibilidad Planta',  i:'📊', sub:`${crits} equipos fuera de línea`, color:disp>=80?'green':disp>=60?'yellow':'red'},
    ];
  }
  if (tipo === 'activos') {
    const operativos = all.filter(x=>x.c.estado==='ok').length;
    const total = all.length;
    const actTotal  = activosEmpresariales.length;
    const actOper   = activosEmpresariales.filter(a=>a.estado==='operativo').length;
    const actBaja   = activosEmpresariales.filter(a=>a.estado==='baja'||a.estado==='dañado').length;
    const actSinR   = activosEmpresariales.filter(a=>!a.responsable).length;
    const valorTotal= activosEmpresariales.reduce((s,a)=>s+(a.costo||0),0);
    return [
      {v:actTotal,  l:'Total Activos',       i:'🗂️', sub:`${fmtCop(valorTotal)} en inventario`, color:'blue'},
      {v:actOper,   l:'Activos Operativos',  i:'✅', sub:`${actTotal?Math.round(actOper/actTotal*100):0}% disponibles`, color:'green'},
      {v:actBaja,   l:'Dañados / Baja',      i:'⚠️', sub:'Requieren atención', color:'yellow'},
      {v:actSinR,   l:'Sin Responsable',     i:'👤', sub:'Sin asignación', color:'red'},
    ];
  }
  if (tipo === 'transporte') {
    const hoy = new Date();
    const vencidos = all.filter(x => {
      const eq = x.eq;
      return (eq.soat && new Date(eq.soat) < hoy) ||
             (eq.tecno && new Date(eq.tecno) < hoy);
    }).length;
    const ok   = all.filter(x=>x.c.estado==='ok').length;
    const mant = all.filter(x=>x.c.estado!=='ok').length;
    const disp = all.length ? Math.round(ok/all.length*100) : 0;
    return [
      {v:all.length,  l:cfg.stat1.label, i:cfg.stat1.icono, sub:`${disp}% disponibilidad`, color:'blue'},
      {v:ok,          l:cfg.stat2.label, i:'✅',             sub:'En circulación',          color:'green'},
      {v:mant,        l:cfg.stat3.label, i:'🔧',             sub:'Requieren atención',      color:'yellow'},
      {v:vencidos,    l:cfg.stat4.label, i:'⚠️',             sub:'SOAT o Tecno vencido',    color:'red'},
    ];
  } else if (tipo === 'construccion') {
    const ok   = all.filter(x=>x.c.estado==='ok').length;
    const hidOk= all.filter(x=>!x.eq['presion-hid'] || x.c.saludPct>60).length;
    const mant = all.filter(x=>x.c.diasMantenimiento<=15).length;
    const disp = all.length ? Math.round(ok/all.length*100) : 0;
    return [
      {v:all.length, l:cfg.stat1.label, i:cfg.stat1.icono, sub:`${avgS}% salud promedio`, color:'blue'},
      {v:hidOk,      l:cfg.stat2.label, i:cfg.stat2.icono, sub:'Sistema hidráulico OK',   color:'green'},
      {v:mant,       l:cfg.stat3.label, i:cfg.stat3.icono, sub:'Próximos 15 días',        color:'yellow'},
      {v:disp+'%',   l:cfg.stat4.label, i:cfg.stat4.icono, sub:'Disponibilidad operativa',color:'green'},
    ];
  } else {
    // industrial (default)
    const ok   = all.filter(x=>x.c.estado==='ok').length;
    const warn = all.filter(x=>x.c.estado==='warn').length;
    const crit = all.filter(x=>x.c.estado==='crit').length;
    return [
      {v:all.length, l:'Equipos Registrados', i:'⚙️', sub:`Salud promedio ${avgS}%`, color:'blue'},
      {v:ok,         l:'En Buen Estado',      i:'✅', sub:`${all.length?Math.round(ok/all.length*100):0}% de la flota`, color:'green'},
      {v:warn,       l:'Requiere Atención',   i:'⚠️', sub:'Mantenimiento próximo',   color:'yellow'},
      {v:crit,       l:'Estado Crítico',      i:'🔴', sub:'Intervención urgente',    color:'red'},
    ];
  }
}

function getNombreActivo(plural) {
  const cfg = SECTOR_CONFIG[getTipoEmpresa()];
  if (!cfg) return plural ? 'Equipos' : 'Equipo';
  const parts = cfg.activos.split(' / ');
  return plural ? parts[0] : parts[1] || parts[0];
}

function getMensajesIASector(all) {
  const tipo = getTipoEmpresa();
  const cfg  = SECTOR_CONFIG[tipo];
  if (!cfg || !all.length) return [];
  const msgs = [];
  const avgS = Math.round(all.reduce((s,x)=>s+x.c.saludPct,0)/all.length);

  // ─── 🚌 TRANSPORTE ───────────────────────────────────
  if (tipo === 'transporte') {
    let totalDocVenc=0, totalDocCrit=0, totalDocProx=0;
    let totalMantVenc=0, totalMantCrit=0, totalMantProx=0;
    const frenoCrit=[], llantasCrit=[], docVencVehs=[], mantUrgVehs=[];

    all.forEach(({eq})=>{
      const mia  = calcularMantenimientoIA(eq);
      const extra= eq.extra||{};
      const nombre=eq.nombre||eq.tipo;

      // Documentos
      const dVenc=mia.docs.filter(d=>d.estado==='vencido');
      const dCrit=mia.docs.filter(d=>d.estado==='critico');
      const dProx=mia.docs.filter(d=>d.estado==='proximo');
      totalDocVenc+=dVenc.length; totalDocCrit+=dCrit.length; totalDocProx+=dProx.length;
      if(dVenc.length>0) docVencVehs.push({nombre,docs:dVenc.map(d=>d.nombre).join(', ')});

      // Mantenimientos
      const mVenc=mia.plan.filter(m=>m.urgencia==='vencido');
      const mCrit=mia.plan.filter(m=>m.urgencia==='critico');
      const mProx=mia.plan.filter(m=>m.urgencia==='proximo');
      totalMantVenc+=mVenc.length; totalMantCrit+=mCrit.length; totalMantProx+=mProx.length;
      if(mVenc.length>0||mCrit.length>0) mantUrgVehs.push({nombre,tipos:[...mVenc,...mCrit].slice(0,2).map(m=>m.nombre).join(', ')});

      // Mecánico
      if(extra.frenos==='Crítico') frenoCrit.push(nombre);
      if(extra.llantas==='Cambio urgente') llantasCrit.push(nombre);
    });

    // Mensajes críticos primero
    if(totalDocVenc>0) msgs.push({nivel:'crit',icono:'📋',
      texto:`<strong>${totalDocVenc} documento${totalDocVenc>1?'s vencidos':'vencido'}</strong> en ${docVencVehs.length} vehículo${docVencVehs.length>1?'s':''}: <strong>${docVencVehs.slice(0,2).map(v=>v.nombre+' ('+v.docs+')').join(', ')}</strong>. Circulación sujeta a inmovilización inmediata por autoridades de tránsito.`});
    if(frenoCrit.length>0) msgs.push({nivel:'crit',icono:'🛑',
      texto:`<strong>${frenoCrit.length} vehículo${frenoCrit.length>1?'s presentan':'presenta'} frenos en estado crítico</strong>: <strong>${frenoCrit.join(', ')}</strong>. Retiro inmediato de circulación hasta completar reparación.`});
    if(llantasCrit.length>0) msgs.push({nivel:'crit',icono:'🔄',
      texto:`<strong>${llantasCrit.length} vehículo${llantasCrit.length>1?'s requieren':'requiere'} cambio urgente de llantas</strong>: <strong>${llantasCrit.join(', ')}</strong>. Riesgo de reventón en operación.`});
    if(totalMantVenc>0) msgs.push({nivel:'crit',icono:'🔧',
      texto:`<strong>${totalMantVenc} servicio${totalMantVenc>1?'s de mantenimiento superan':' de mantenimiento supera'} el kilometraje límite</strong> en ${mantUrgVehs.length} vehículo${mantUrgVehs.length>1?'s':''}: ${mantUrgVehs.slice(0,2).map(v=>v.nombre).join(', ')}. La IA recomienda intervención inmediata.`});

    // Advertencias
    if(totalDocCrit>0&&!msgs.find(m=>m.nivel==='crit'&&m.icono==='📋')) msgs.push({nivel:'warn',icono:'📋',
      texto:`<strong>${totalDocCrit} documento${totalDocCrit>1?'s vencen':'vence'} en menos de 7 días</strong>. Gestionar renovaciones de forma urgente para evitar inmovilizaciones.`});
    if(totalDocProx>0) msgs.push({nivel:'warn',icono:'⏰',
      texto:`<strong>${totalDocProx} documento${totalDocProx>1?'s vencen':'vence'} en los próximos 30 días</strong>. Programar renovaciones con anticipación para garantizar la operación continua de la flota.`});
    if(totalMantCrit>0) msgs.push({nivel:'warn',icono:'🔧',
      texto:`<strong>${totalMantCrit} servicio${totalMantCrit>1?'s de mantenimiento':'de mantenimiento'} alcanzan el límite de kilometraje esta semana</strong>. La IA recomienda programar los servicios preventivos de forma urgente.`});
    if(totalMantProx>0) msgs.push({nivel:'warn',icono:'⏱',
      texto:`<strong>${totalMantProx} mantenimiento${totalMantProx>1?'s preventivos':'preventivo'} próximos a vencer</strong> según el plan IA de la flota. Revisar el cronograma de servicios.`});

    if(!msgs.length) msgs.push({nivel:'ok',icono:'🟢',
      texto:`La flota de <strong>${all.length} vehículo${all.length>1?'s':''}</strong> se encuentra en condición óptima. Documentación vigente, mantenimientos al día y estado mecánico adecuado. Índice de salud promedio: <strong>${avgS}%</strong>.`});
  }

  // ─── ⚙️ INDUSTRIAL ──────────────────────────────────
  else if (tipo === 'industrial') {
    let critRiesgo=[], altoRiesgo=[], anomCrit=[], anomWarn=[], mantUrg=[], mantProx=[];

    all.forEach(({eq,c})=>{
      const mia   = calcularMantenimientoIAIndustrial(eq);
      const nombre= eq.nombre||eq.tipo;
      if(mia.nivelRiesgo==='critico') critRiesgo.push({nombre,riesgo:mia.riesgo,anomalias:mia.anomalias});
      else if(mia.nivelRiesgo==='alto') altoRiesgo.push({nombre,riesgo:mia.riesgo});
      mia.anomalias.forEach(a=>{
        if(a.tipo==='crit') anomCrit.push({nombre,msg:a.msg,icono:a.icono});
        else anomWarn.push({nombre,msg:a.msg,icono:a.icono});
      });
      mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico')
        .forEach(m=>mantUrg.push({nombre,tipo:m.nombre,horas:m.horasRestantes}));
      mia.plan.filter(m=>m.urgencia==='proximo')
        .forEach(m=>mantProx.push({nombre,tipo:m.nombre,horas:m.horasRestantes}));
    });

    // Mensajes críticos
    if(critRiesgo.length>0) msgs.push({nivel:'crit',icono:'🚨',
      texto:`<strong>${critRiesgo.length} equipo${critRiesgo.length>1?'s':''} en RIESGO CRÍTICO</strong> según el análisis IA: <strong>${critRiesgo.slice(0,3).map(e=>e.nombre+' ('+e.riesgo+'/100)').join(', ')}</strong>. Variables fuera de parámetros. Detener operación e inspeccionar inmediatamente.`});
    if(anomCrit.length>0) msgs.push({nivel:'crit',icono:'⚠️',
      texto:`La IA detecta <strong>${anomCrit.length} anomalía${anomCrit.length>1?'s críticas':' crítica'}</strong> en variables operacionales: ${anomCrit.slice(0,2).map(a=>'<strong>'+a.nombre+'</strong> — '+a.msg.slice(0,60)).join(' · ')}. Requieren atención inmediata.`});
    if(mantUrg.length>0) msgs.push({nivel:'crit',icono:'🔧',
      texto:`<strong>${mantUrg.length} mantenimiento${mantUrg.length>1?'s':''} industrial${mantUrg.length>1?'es':''} vencidos o críticos</strong> según el plan IA: ${mantUrg.slice(0,2).map(m=>m.nombre+' — '+m.tipo).join(', ')}. Programar intervenciones de forma urgente para evitar fallas no planificadas.`});

    // Advertencias
    if(altoRiesgo.length>0&&critRiesgo.length===0) msgs.push({nivel:'warn',icono:'🔴',
      texto:`<strong>${altoRiesgo.length} equipo${altoRiesgo.length>1?'s':''} con riesgo alto</strong>: <strong>${altoRiesgo.slice(0,3).map(e=>e.nombre).join(', ')}</strong>. Programar inspección preventiva prioritaria en las próximas 24-48 horas.`});
    if(anomWarn.length>0) msgs.push({nivel:'warn',icono:'📊',
      texto:`La IA detecta <strong>${anomWarn.length} variable${anomWarn.length>1?'s':''} operacional${anomWarn.length>1?'es':''} en alerta</strong> en los equipos de planta. Monitorear de cerca y programar revisiones preventivas.`});
    if(mantProx.length>0) msgs.push({nivel:'warn',icono:'⏱',
      texto:`<strong>${mantProx.length} mantenimiento${mantProx.length>1?'s':''} preventivo${mantProx.length>1?'s':''} próximos</strong> según el plan IA de la planta. Planificar las intervenciones para evitar paradas no programadas.`});

    // Salud general de planta
    const crits=all.filter(x=>x.c.estado==='crit');
    if(crits.length>0&&!msgs.find(m=>m.icono==='🚨')) msgs.push({nivel:'crit',icono:'🔴',
      texto:`<strong>${crits.length} equipo${crits.length>1?'s':''} en estado crítico</strong>: ${crits.map(x=>x.eq.nombre||x.eq.tipo).join(', ')}. Índice de salud promedio de planta: <strong>${avgS}%</strong>.`});
    if(!msgs.length) msgs.push({nivel:'ok',icono:'🟢',
      texto:`La planta opera en condiciones óptimas. Índice de salud promedio: <strong>${avgS}%</strong>. El análisis IA no detecta anomalías en variables operacionales. Continuar con el plan de mantenimiento preventivo.`});
  }

  // ─── 🏗️ CONSTRUCCIÓN ────────────────────────────────
  else if (tipo === 'construccion') {
    let hidCrit=[], hidWarn=[], estrCrit=[], estrWarn=[], mantUrg=[], mantProx=[], tempCrit=[];

    all.forEach(({eq})=>{
      const mia    = calcularMantenimientoIAConstruccion(eq);
      const nombre = eq.nombre||eq.tipo;
      mia.alertas.forEach(a=>{
        if(a.icono==='💧'){ a.tipo==='crit'?hidCrit.push({nombre,msg:a.msg}):hidWarn.push({nombre,msg:a.msg}); }
        else if(a.icono==='🏗️'||a.icono==='🔩'){ a.tipo==='crit'?estrCrit.push({nombre,msg:a.msg}):estrWarn.push({nombre,msg:a.msg}); }
        else if(a.icono==='🌡️') tempCrit.push({nombre,msg:a.msg});
      });
      mia.plan.filter(m=>m.urgencia==='vencido'||m.urgencia==='critico').forEach(m=>mantUrg.push({nombre,tipo:m.nombre}));
      mia.plan.filter(m=>m.urgencia==='proximo').forEach(m=>mantProx.push({nombre,tipo:m.nombre}));
    });

    if(estrCrit.length>0) msgs.push({nivel:'crit',icono:'🏗️',
      texto:`<strong>${estrCrit.length} máquina${estrCrit.length>1?'s presentan':'presenta'} daño estructural</strong>: <strong>${estrCrit.map(e=>e.nombre).join(', ')}</strong>. Paralizar operaciones. Riesgo grave para el personal de obra.`});
    if(hidCrit.length>0) msgs.push({nivel:'crit',icono:'💧',
      texto:`<strong>${hidCrit.length} equipo${hidCrit.length>1?'s con':'con'} falla hidráulica crítica</strong>: <strong>${hidCrit.map(e=>e.nombre).join(', ')}</strong>. Sistema hidráulico comprometido. Detener y reparar.`});
    if(tempCrit.length>0) msgs.push({nivel:'crit',icono:'🌡️',
      texto:`<strong>${tempCrit.length} máquina${tempCrit.length>1?'s presentan':'presenta'} temperatura de motor crítica</strong>: ${tempCrit.map(e=>e.nombre).join(', ')}. Sobrecalentamiento severo detectado.`});
    if(mantUrg.length>0) msgs.push({nivel:'crit',icono:'🔧',
      texto:`<strong>${mantUrg.length} mantenimiento${mantUrg.length>1?'s de':'de'} maquinaria pesada vencidos o críticos</strong>: ${mantUrg.slice(0,2).map(m=>m.nombre+' — '+m.tipo).join(', ')}. Programar intervención urgente.`});
    if(hidWarn.length>0) msgs.push({nivel:'warn',icono:'💧',
      texto:`<strong>${hidWarn.length} equipo${hidWarn.length>1?'s requieren':'requiere'} revisión hidráulica</strong>. Programar inspección preventiva.`});
    if(estrWarn.length>0) msgs.push({nivel:'warn',icono:'🔩',
      texto:`<strong>${estrWarn.length} máquina${estrWarn.length>1?'s con':'con'} desgaste estructural moderado</strong>. Programar inspecciones técnicas antes de operaciones de alta carga.`});
    if(mantProx.length>0) msgs.push({nivel:'warn',icono:'⏱',
      texto:`<strong>${mantProx.length} mantenimiento${mantProx.length>1?'s preventivos':'preventivo'} próximos</strong> según el plan IA. Planificar intervenciones para evitar paradas en obra.`});
    const crits=all.filter(x=>x.c.estado==='crit');
    if(crits.length>0&&!msgs.find(m=>m.nivel==='crit')) msgs.push({nivel:'crit',icono:'🔴',
      texto:`<strong>${crits.length} máquina${crits.length>1?'s':''} en estado crítico</strong>. Salud promedio: <strong>${avgS}%</strong>. Intervención urgente requerida.`});
    if(!msgs.length) msgs.push({nivel:'ok',icono:'🟢',
      texto:`La maquinaria pesada opera en condiciones óptimas. Índice de salud promedio: <strong>${avgS}%</strong>. Sistema hidráulico y estructura en buen estado. Continuar con el plan preventivo IA.`});
  }
  return msgs;
}

function generarMensajesSistema() {
  if (!equipos.length) return [];
  const all    = equipos.map(e=>({eq:e, c:calcEquipo(e)}));
  const crits  = all.filter(x=>x.c.estado==='crit');
  const warns  = all.filter(x=>x.c.estado==='warn');
  const avgS   = Math.round(all.reduce((s,x)=>s+x.c.saludPct,0)/all.length);
  const severos= all.filter(x=>x.eq.factor>=1.5);
  const urgentes=all.filter(x=>x.c.diasMantenimiento<=7&&x.c.diasMantenimiento>0);
  const totalCorr=mantenimientos.filter(m=>m.tipo==='Correctivo').length;
  const totalPrev=mantenimientos.filter(m=>m.tipo==='Preventivo').length;
  const pctCorr=totalCorr+totalPrev>0?Math.round(totalCorr/(totalCorr+totalPrev)*100):0;
  const msgs = [];

  // ── Diagnóstico general de flota ────────────────────────
  if (crits.length === 0 && warns.length === 0) {
    const mejorEq = all.sort((a,b)=>b.c.saludPct-a.c.saludPct)[0];
    msgs.push({ nivel:'ok', icono:'🟢',
      texto:`La flota de <strong>${equipos.length} equipo${equipos.length>1?'s':''}</strong> se encuentra en <strong>condición operativa estable</strong>. El índice de salud promedio es <strong>${avgS}%</strong>, lo que indica que todos los activos operan dentro de los parámetros establecidos por el fabricante. El equipo con mejor desempeño es <strong>${mejorEq.eq.nombre}</strong> con ${mejorEq.c.saludPct}% de salud.`
    });
  } else if (crits.length === 0) {
    msgs.push({ nivel:'warn', icono:'🟡',
      texto:`La flota opera en <strong>condición de atención moderada</strong>. Se detectan <strong>${warns.length} equipo${warns.length>1?'s':''} con desgaste avanzado</strong> que requieren intervención preventiva próxima: <strong>${warns.map(x=>x.eq.nombre).join(', ')}</strong>. El índice de salud promedio de la flota es <strong>${avgS}%</strong>. Actuar ahora previene la escalada a fallas correctivas, que son en promedio 3.2× más costosas.`
    });
  } else {
    const critNombres = crits.sort((a,b)=>a.c.saludPct-b.c.saludPct).map(x=>x.eq.nombre);
    msgs.push({ nivel:'crit', icono:'🔴',
      texto:`⚠️ La flota se encuentra en <strong>condición de riesgo operacional</strong>. <strong>${crits.length} equipo${crits.length>1?'s presentan':' presenta'} estado crítico</strong>: <strong>${critNombres.join(', ')}</strong>. Con un índice de salud promedio de <strong>${avgS}%</strong> y múltiples activos comprometidos, existe riesgo de paralización operativa. Se requiere intervención inmediata para garantizar la continuidad del proceso productivo.`
    });
  }

  // ── Análisis de patrón de mantenimiento ─────────────────
  if (totalCorr + totalPrev >= 3) {
    if (pctCorr > 60) {
      msgs.push({ nivel:'crit', icono:'💸',
        texto:`El análisis del historial detecta un <strong>patrón reactivo dominante</strong>: el <strong>${pctCorr}% de las intervenciones son correctivas</strong> (${totalCorr} de ${totalCorr+totalPrev}). Esto indica que el sistema opera en modo reactivo en lugar de preventivo, generando costos operativos significativamente más elevados. Implementar un plan preventivo estructurado puede reducir los costos de mantenimiento hasta en un 68%.`
      });
    } else if (pctCorr > 30) {
      msgs.push({ nivel:'warn', icono:'📊',
        texto:`El historial muestra una <strong>mezcla de mantenimiento preventivo y correctivo</strong> (${100-pctCorr}% preventivo / ${pctCorr}% correctivo). Si bien hay presencia de mantenimiento planificado, aún existe margen para mejorar la proporción preventiva y reducir costos operativos no planificados.`
      });
    } else {
      msgs.push({ nivel:'ok', icono:'🏆',
        texto:`El historial refleja una <strong>estrategia de mantenimiento preventivo consolidada</strong>: el <strong>${100-pctCorr}% de las intervenciones son planificadas</strong>. Este patrón es consistente con las mejores prácticas de gestión de activos industriales y minimiza el riesgo de fallas no programadas.`
      });
    }
  }

  // ── Uso intensivo ────────────────────────────────────────
  if (severos.length > 0) {
    const nomSev = severos.map(x=>x.eq.nombre).join(', ');
    msgs.push({ nivel:'warn', icono:'⚡',
      texto:`Se identifican <strong>${severos.length} equipo${severos.length>1?'s operando':' operando'} en régimen de uso intensivo</strong> (factor ≥1.5×): <strong>${nomSev}</strong>. El desgaste acelerado implica que sus ciclos efectivos de mantenimiento son considerablemente más cortos que los indicados por el fabricante. Es recomendable revisar los intervalos de inspección de estos activos.`
    });
  }

  // ── Ventana crítica de mantenimiento ────────────────────
  if (urgentes.length > 0) {
    const urgStr = urgentes.map(x=>`${x.eq.nombre} (${x.c.diasMantenimiento}d)`).join(', ');
    msgs.push({ nivel:'warn', icono:'📅',
      texto:`<strong>${urgentes.length} equipo${urgentes.length>1?'s alcanzan':' alcanza'} su ventana de mantenimiento esta semana</strong>: <strong>${urgStr}</strong>. Programar estas intervenciones de forma anticipada evita paros no planificados y garantiza la disponibilidad operativa de los activos.`
    });
  }

  return msgs;
}