import { t, tr, label } from '../i18n.js';
import { h, icon, sectionHeader, fmt } from '../ui.js';
import { rows } from '../app.js';

export default async function render(root) {
  const alts = await rows('alts-carrecs');
  const direccions = alts.filter((a) => a.lloc !== 'direccio_general');

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'building', title: t('nav_institucio'), intro: t('intro_institucio') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);

  c.appendChild(h(`
    <div class="two-col">
      <section class="card prose">
        <h2 class="card-title">${tr('Qui som', 'Quiénes somos', 'Who we are')}</h2>
        <p>${tr(
          'El Consorci de Turisme de Barcelona és un consorci públic constituït el 1993 per l’Ajuntament de Barcelona, la Cambra Oficial de Comerç, Indústria, Serveis i Navegació de Barcelona i la Fundació Barcelona Promoció, amb la finalitat de promocionar la ciutat com a destinació turística i de gestionar serveis d’informació i productes turístics.',
          'El Consorci de Turisme de Barcelona es un consorcio público constituido en 1993 por el Ayuntamiento de Barcelona, la Cámara Oficial de Comercio, Industria, Servicios y Navegación de Barcelona y la Fundació Barcelona Promoció, con la finalidad de promocionar la ciudad como destino turístico y de gestionar servicios de información y productos turísticos.',
          'The Barcelona Tourism Consortium is a public consortium set up in 1993 by Barcelona City Council, the Barcelona Chamber of Commerce and the Barcelona Promotion Foundation to promote the city as a destination and to run visitor information services and tourism products.')}</p>
        <p>${tr(
          'Com a ens del sector públic, està subjecte a la Llei 19/2014 de transparència, accés a la informació pública i bon govern, i rendeix comptes a la ciutadania a través d’aquest portal.',
          'Como ente del sector público, está sujeto a la Ley 19/2014 de transparencia, acceso a la información pública y buen gobierno, y rinde cuentas a la ciudadanía a través de este portal.',
          'As a public-sector body it is subject to Catalan Law 19/2014 on transparency, access to public information and good governance, and is accountable to the public through this portal.')}</p>
        <h3>${tr('Funcions principals', 'Funciones principales', 'Main functions')}</h3>
        <ul class="check-list">
          <li>${tr('Promoció internacional de Barcelona com a destinació de lleure i de negocis', 'Promoción internacional de Barcelona como destino de ocio y de negocios', 'International promotion of Barcelona for leisure and business')}</li>
          <li>${tr('Captació de congressos i esdeveniments (Barcelona Convention Bureau)', 'Captación de congresos y eventos (Barcelona Convention Bureau)', 'Attracting conferences and events (Barcelona Convention Bureau)')}</li>
          <li>${tr('Informació i atenció al visitant', 'Información y atención al visitante', 'Visitor information services')}</li>
          <li>${tr('Gestió de productes turístics que financen l’activitat', 'Gestión de productos turísticos que financian la actividad', 'Running tourism products that fund its activity')}</li>
          <li>${tr('Gestió responsable del turisme i retorn als barris', 'Gestión responsable del turismo y retorno a los barrios', 'Responsible tourism management and returns to neighbourhoods')}</li>
        </ul>
      </section>
      <section class="card">
        <h2 class="card-title">${tr('Entitats consorciades', 'Entidades consorciadas', 'Member bodies')}</h2>
        <ul class="entity-list">
          <li>${icon('building', 22)}<div><strong>Ajuntament de Barcelona</strong><span>${tr('Administració local', 'Administración local', 'Local government')}</span></div></li>
          <li>${icon('building', 22)}<div><strong>${tr('Cambra Oficial de Comerç, Indústria, Serveis i Navegació de Barcelona', 'Cámara Oficial de Comercio, Industria, Servicios y Navegación de Barcelona', 'Barcelona Chamber of Commerce')}</strong><span>${tr('Corporació de dret públic', 'Corporación de derecho público', 'Public-law corporation')}</span></div></li>
          <li>${icon('building', 22)}<div><strong>Fundació Barcelona Promoció</strong><span>${tr('Fundació', 'Fundación', 'Foundation')}</span></div></li>
        </ul>
        <h3 class="card-title small-title">${tr('Òrgans de govern', 'Órganos de gobierno', 'Governing bodies')}</h3>
        <dl class="org-bodies">
          <div><dt>${tr('Consell General', 'Consejo General', 'General Council')}</dt><dd>${tr('Màxim òrgan de govern. Hi són representades les entitats consorciades; aprova pressupostos, comptes i plans.', 'Máximo órgano de gobierno. Están representadas las entidades consorciadas; aprueba presupuestos, cuentas y planes.', 'Highest governing body, representing member bodies; approves budgets, accounts and plans.')}</dd></div>
          <div><dt>${tr('Comitè Executiu', 'Comité Ejecutivo', 'Executive Committee')}</dt><dd>${tr('Direcció i seguiment ordinari de l’activitat per delegació del Consell General.', 'Dirección y seguimiento ordinario de la actividad por delegación del Consejo General.', 'Ongoing oversight of activity, by delegation of the General Council.')}</dd></div>
          <div><dt>${tr('Presidència', 'Presidencia', 'Presidency')}</dt><dd>${tr('Representació institucional del Consorci.', 'Representación institucional del Consorcio.', 'Institutional representation.')}</dd></div>
          <div><dt>${tr('Direcció General', 'Dirección General', 'Director General')}</dt><dd>${tr('Gestió executiva i direcció de l’organització.', 'Gestión ejecutiva y dirección de la organización.', 'Executive management of the organisation.')}</dd></div>
        </dl>
        <p class="muted small">${icon('info', 14)} ${tr('Composició nominal, actes i acords de cada òrgan: pendent d’enllaçar amb el repositori documental.', 'Composición nominal, actas y acuerdos de cada órgano: pendiente de enlazar con el repositorio documental.', 'Named membership, minutes and resolutions: to be linked to the document repository.')}</p>
      </section>
    </div>`));

  c.appendChild(h(`
    <section class="card">
      <h2 class="card-title">${tr('Organigrama', 'Organigrama', 'Organisation chart')}</h2>
      <div class="orgchart" role="tree" aria-label="${tr('Organigrama', 'Organigrama', 'Organisation chart')}">
        <div class="org-level"><div class="org-node org-gov" role="treeitem">${tr('Consell General', 'Consejo General', 'General Council')}<small>${tr('i Comitè Executiu', 'y Comité Ejecutivo', 'and Executive Committee')}</small></div></div>
        <div class="org-level"><a class="org-node org-top" role="treeitem" href="#/bon-govern">${label('lloc', 'direccio_general')}<small>${fmt.eur(alts.find((a) => a.lloc === 'direccio_general').retribucio_fixa)} ${tr('bruts/any', 'brutos/año', 'gross/yr')}</small></a></div>
        <ul class="org-level org-children" role="group">
          ${direccions.map((d) => `<li><a class="org-node" role="treeitem" href="#/bon-govern">${label('lloc', d.lloc)}<small>${fmt.eur(d.retribucio_fixa)} ${tr('bruts/any', 'brutos/año', 'gross/yr')}</small></a></li>`).join('')}
        </ul>
      </div>
    </section>`));

  const NORMES = [
    ['Estatuts del Consorci de Turisme de Barcelona', 'Estatutos del Consorci de Turisme de Barcelona', 'Statutes of the Consortium', null],
    ['Llei 19/2014, de transparència, accés a la informació pública i bon govern', 'Ley 19/2014, de transparencia, acceso a la información pública y buen gobierno (Cataluña)', 'Law 19/2014 on transparency, access to public information and good governance', 'https://www.boe.es/eli/es-ct/l/2014/12/29/19'],
    ['Llei 13/2002, de turisme de Catalunya', 'Ley 13/2002, de turismo de Cataluña', 'Law 13/2002 on tourism in Catalonia', 'https://www.boe.es/eli/es-ct/l/2002/06/21/13'],
    ['Llei 9/2017, de contractes del sector públic', 'Ley 9/2017, de contratos del sector público', 'Law 9/2017 on public-sector contracts', 'https://www.boe.es/eli/es/l/2017/11/08/9'],
    ['Llei 2/2023, de protecció de les persones informants', 'Ley 2/2023, de protección de las personas informantes', 'Law 2/2023 on whistleblower protection', 'https://www.boe.es/eli/es/l/2023/02/20/2'],
    ['Reglament (UE) 2016/679, general de protecció de dades', 'Reglamento (UE) 2016/679, general de protección de datos', 'Regulation (EU) 2016/679 (GDPR)', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj'],
  ];
  c.appendChild(h(`
    <section class="card">
      <h2 class="card-title">${tr('Normativa aplicable', 'Normativa aplicable', 'Applicable legislation')}</h2>
      <ul class="doc-list">${NORMES.map(([ca, es, en, url]) => `<li>${icon('file', 18)}<span>${tr(ca, es, en)}</span>${url ? `<a href="${url}" rel="noopener" class="small">ELI ${icon('external', 14)}</a>` : `<span class="badge badge-neutral">${tr('Document pendent', 'Documento pendiente', 'Document pending')}</span>`}</li>`).join('')}</ul>
      <p class="muted small">${tr('Els enllaços utilitzen l’identificador europeu de legislació (ELI), estable i llegible per màquines.', 'Los enlaces utilizan el identificador europeo de legislación (ELI), estable y legible por máquinas.', 'Links use the European Legislation Identifier (ELI), stable and machine-readable.')}</p>
    </section>`));
}
