export function renderContact(context) {
  const { config, t, arrow } = context;

  return `<div class="contact-details">
    <section>
      <h2>${t('email')}</h2>
      <p><a href="mailto:${config.email}">${config.email}</a></p>
      <a class="button" href="mailto:${config.email}">${t('writeToUs')} ${arrow}</a>
    </section>
    <section>
      <h2>${t('addressLabel')}</h2>
      <address>${t('address')}</address>
    </section>
  </div>
  <div class="contact-institution">
    <strong>${t('fullName')} (AIMI)</strong><br>${t('institute')}<br>${t('institution')}
  </div>`;
}
