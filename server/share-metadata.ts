import { storefrontOrigin } from '../src/store-routes.ts';

const siteTitle = 'ნაწილები — ავტონაწილების კატალოგი';
const siteDescription = 'ავტონაწილების კატალოგი. იპოვე საჭირო ნაწილი, შეამოწმე თავსებადობა და ნახე მარაგი.';
const siteImage = {
  url: `${storefrontOrigin}/images/share-cover.jpg`,
  alt: 'Nissan X-Trail, Mitsubishi Airtrek, Lexus RX და Honda CR-V',
  width: 1200,
  height: 600,
};

type ShareImage = { url: string; alt: string; width?: number; height?: number };
type ShareMetadata = {
  title: string;
  description: string;
  url: string;
  image?: ShareImage;
  noindex?: boolean;
};

const siteMetadata = { title: siteTitle, description: siteDescription, url: `${storefrontOrigin}/` };
const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
const shareBlock = /<!-- share metadata -->[\s\S]*?<!-- end share metadata -->/;

function imageTags(image: ShareImage) {
  return [
    ['og:image', image.url],
    ['og:image:alt', image.alt],
    ...(image.width && image.height ? [
      ['og:image:width', String(image.width)],
      ['og:image:height', String(image.height)],
      ['og:image:type', 'image/jpeg'],
    ] : []),
  ];
}

export function renderShareMetadata(html: string, metadata: ShareMetadata = siteMetadata) {
  const { title, description, url, image, noindex } = metadata;
  const graph = [
    ['og:type', 'website'], ['og:site_name', 'ნაწილები'], ['og:locale', 'ka_GE'],
    ['og:title', title], ['og:description', description], ['og:url', url],
    ...imageTags(image ?? siteImage),
    ...(image ? imageTags(siteImage) : []),
  ];
  const card = [
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', title], ['twitter:description', description],
    ['twitter:image', (image ?? siteImage).url], ['twitter:image:alt', (image ?? siteImage).alt],
  ];
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    ...(noindex ? ['<meta name="robots" content="noindex" />'] : []),
    ...graph.map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`),
    ...card.map(([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}" />`),
  ];
  return html.replace(shareBlock, () => ['<!-- share metadata -->', ...tags, '<!-- end share metadata -->'].join('\n    '));
}
