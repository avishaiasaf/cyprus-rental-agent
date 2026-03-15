import type { RawListing, PriceChange } from '../types/listing.js';

export function buildListingMessage(listing: RawListing): string {
  const lines: string[] = [];

  // Type badge + title
  const badge = listing.listingType === 'rent' ? '🏠 FOR RENT' : '💰 FOR SALE';
  lines.push(`<b>${badge}</b>`);
  lines.push(`<b><a href="${escapeHtml(listing.url)}">${escapeHtml(listing.title)}</a></b>`);
  lines.push('');

  // Price
  if (listing.price !== null) {
    const priceStr = formatPrice(listing.price);
    const suffix = listing.listingType === 'rent' ? '/mo' : '';
    lines.push(`💰 <b>${priceStr}${suffix}</b>`);
  } else {
    lines.push('💰 <i>Price on request</i>');
  }

  // Location
  if (listing.location) {
    lines.push(`📍 ${escapeHtml(listing.location)}`);
  }

  // Property details line
  const details: string[] = [];
  if (listing.propertyType) details.push(capitalize(listing.propertyType));
  if (listing.bedrooms != null) details.push(`${listing.bedrooms} bed`);
  if (listing.bathrooms != null) details.push(`${listing.bathrooms} bath`);
  if (listing.areaSqm != null) details.push(`${listing.areaSqm} m²`);
  if (listing.furnished === true) details.push('Furnished');
  if (listing.furnished === false) details.push('Unfurnished');
  if (details.length > 0) {
    lines.push(`🏗 ${details.join(' · ')}`);
  }

  // Amenities
  if (listing.amenities && listing.amenities.length > 0) {
    const shown = listing.amenities.slice(0, 6).join(', ');
    const more = listing.amenities.length > 6 ? ` +${listing.amenities.length - 6} more` : '';
    lines.push(`✅ ${escapeHtml(shown)}${more}`);
  }

  // Description (truncated)
  if (listing.description) {
    lines.push('');
    const desc = listing.description.length > 500
      ? listing.description.slice(0, 500) + '...'
      : listing.description;
    lines.push(escapeHtml(desc));
  }

  // Contact info
  const contacts: string[] = [];
  if (listing.contactName) contacts.push(escapeHtml(listing.contactName));
  if (listing.agencyName) contacts.push(escapeHtml(listing.agencyName));
  if (listing.contactPhone) contacts.push(`📞 ${escapeHtml(listing.contactPhone)}`);
  if (listing.contactEmail) contacts.push(`✉️ ${escapeHtml(listing.contactEmail)}`);
  if (contacts.length > 0) {
    lines.push('');
    lines.push(`👤 ${contacts.join(' | ')}`);
  }

  // Source
  lines.push('');
  lines.push(`📋 <i>${escapeHtml(listing.source)}</i>`);

  return lines.join('\n');
}

export function buildPriceChangeMessage(listing: RawListing, change: PriceChange): string {
  const lines: string[] = [];

  const direction = change.newPrice < change.oldPrice ? '📉 PRICE DROP' : '📈 PRICE INCREASE';
  lines.push(`<b>${direction}</b>`);
  lines.push(`<b><a href="${escapeHtml(listing.url)}">${escapeHtml(listing.title)}</a></b>`);
  lines.push('');

  const oldStr = formatPrice(change.oldPrice);
  const newStr = formatPrice(change.newPrice);
  const diff = change.newPrice - change.oldPrice;
  const diffStr = formatPrice(Math.abs(diff));
  const pct = ((diff / change.oldPrice) * 100).toFixed(1);

  lines.push(`${oldStr} → <b>${newStr}</b> (${diff < 0 ? '-' : '+'}${diffStr}, ${pct}%)`);

  if (listing.location) {
    lines.push(`📍 ${escapeHtml(listing.location)}`);
  }

  lines.push('');
  lines.push(`📋 <i>${escapeHtml(listing.source)}</i>`);

  return lines.join('\n');
}

function formatPrice(amount: number): string {
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
