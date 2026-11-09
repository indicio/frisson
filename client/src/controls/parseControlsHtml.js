/** Pull the legacy controls document into markup the React tray can host. */
export function parseControlsHtml(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sheets = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => {
    const href = link.getAttribute('href');
    return href ? new URL(href, pageUrl).href : '';
  }).filter(Boolean);

  const styles = [...doc.querySelectorAll('style')].map((style) => style.outerHTML).join('');
  doc.querySelectorAll('script').forEach((script) => script.remove());
  doc.querySelectorAll('[src], [href]').forEach((el) => {
    const attr = el.hasAttribute('src') ? 'src' : 'href';
    const value = el.getAttribute(attr);
    if (!value || /^(?:[a-z]+:|#|\/)/i.test(value)) return;
    el.setAttribute(attr, new URL(value, pageUrl).href);
  });

  const panel = doc.querySelector('.control-panel');
  const favorites = doc.querySelector('.favorites-panel');
  return {
    sheets,
    html: `${styles}${panel?.outerHTML || ''}${favorites?.outerHTML || ''}`,
  };
}
