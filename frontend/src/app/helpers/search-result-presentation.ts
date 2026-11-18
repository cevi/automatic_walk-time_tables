import { SwisstopoSearchResult } from '../services/swisstopo-search.service';

/**
 * What a search result row shows: a plain-text title (no API HTML), a
 * Material icon and a short type label, e.g. "Haltestelle · Bus".
 */
export interface SearchResultPresentation {
  title: string;
  type: string;
  icon: string;
}

const ORIGIN_LABELS: Record<string, string> = {
  gg25: 'Gemeinde',
  kantone: 'Kanton',
  district: 'Bezirk',
  zipcode: 'Postleitzahl',
  address: 'Adresse',
  haltestellen: 'Haltestelle',
  gazetteer: 'Name',
  parcel: 'Parzelle',
  coordinate: 'Koordinate',
};

const ORIGIN_ICONS: Record<string, string> = {
  gg25: 'location_city',
  kantone: 'map',
  district: 'map',
  zipcode: 'markunread_mailbox',
  address: 'home',
  haltestellen: 'directions_transit',
  gazetteer: 'place',
  parcel: 'crop_square',
  coordinate: 'my_location',
};

/** icons for the <i>…</i> category the API puts in front of a label */
const CATEGORY_ICONS: [RegExp, string][] = [
  [/^bus|^postauto/i, 'directions_bus'],
  [/^zug|^bahn/i, 'train'],
  [/^tram/i, 'tram'],
  [/^schiff/i, 'directions_boat'],
  [
    /seilbahn|^sessellift|^gondel|^standseilbahn/i,
    'airline_seat_recline_normal',
  ],
  [/^gipfel|^hauptgipfel|^haupthuegel|^huegel|^pass/i, 'landscape'],
  [/^flurname|^gebiet|^alp/i, 'terrain'],
  [/^see|^fluss|^bach|^gewaesser/i, 'water'],
  [/^gebaeude|^offenes gebaeude/i, 'home_work'],
];

function textOf(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

// The API writes umlauts as ae/oe/ue in its categories. Only known words
// are fixed, a blanket replace would break e.g. "Feuerwehr".
const UMLAUT_FIXES: [RegExp, string][] = [
  [/Gebaeude/g, 'Gebäude'],
  [/Gewaesser/g, 'Gewässer'],
  [/Huegel/g, 'Hügel'],
  [/huegel/g, 'hügel'],
  [/Flaeche/g, 'Fläche'],
  [/Oeffentlich/g, 'Öffentlich'],
];

/** "Gebaeude Einzelhaus" -> "Gebäude Einzelhaus", "Flurname swisstopo" -> "Flurname" */
function prettifyCategory(category: string): string {
  return UMLAUT_FIXES.reduce(
    (text, [re, fixed]) => text.replace(re, fixed),
    category.replace(/\s*swisstopo$/i, ''),
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function presentSearchResult(
  result: SwisstopoSearchResult,
): SearchResultPresentation {
  const origin = result.attrs.origin;
  const label = result.attrs.label ?? '';

  if (origin === 'coordinate') {
    return { title: label, type: result.attrs.detail, icon: 'my_location' };
  }

  // The API marks the category with a leading <i>…</i>, e.g. "<i>Bus</i> <b>Wald ZH, Bahnhof</b>"
  const categoryMatch = label.match(/^\s*<i>(.*?)<\/i>\s*/i);
  const category = categoryMatch ? textOf(categoryMatch[1]) : '';
  const title = textOf(
    categoryMatch ? label.slice(categoryMatch[0].length) : label,
  );

  const originLabel = ORIGIN_LABELS[origin] ?? '';
  let type = originLabel;
  if (category) {
    const pretty = capitalize(prettifyCategory(category));
    // a named place already says what it is: "Gipfel", "Flurname", …
    type = origin === 'gazetteer' ? pretty : `${originLabel} · ${pretty}`;
  }

  const icon =
    CATEGORY_ICONS.find(([re]) => re.test(category))?.[1] ??
    ORIGIN_ICONS[origin] ??
    'place';

  return { title, type, icon };
}

/**
 * Splits the text into parts that do / do not match one of the words of the
 * query, so they can be rendered without innerHTML. Like geoadmin, every word
 * is matched on its own: "Bahnhof Wald" marks both words.
 */
export function highlightParts(
  text: string,
  query: string | null,
): { text: string; match: boolean }[] {
  const words = (query ?? '')
    .split(/[\s,]+/)
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!text || words.length === 0) return [{ text, match: false }];

  // with a capturing group, split() puts the matches at the odd indices
  const regex = new RegExp(`(${words.join('|')})`, 'i');
  return text
    .split(regex)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((part) => part.text !== '');
}
