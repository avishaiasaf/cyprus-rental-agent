import type { SourceAdapter } from '../types/adapter.js';
import { DomComCyAdapter } from './dom-com-cy/adapter.js';
import { BazarakiAdapter } from './bazaraki/adapter.js';
import { HomeCyAdapter } from './home-cy/adapter.js';
import { IndexCyAdapter } from './index-cy/adapter.js';
import { BuySellCyprusAdapter } from './buysellcyprus/adapter.js';
import { SpitogatosCyAdapter } from './spitogatos-cy/adapter.js';
import { OnlinePropertiesAdapter } from './online-properties/adapter.js';
import { RentalsCyprusAdapter } from './rentals-cyprus/adapter.js';
import { FacebookGroupsAdapter } from './facebook-groups/adapter.js';
import { TelegramChannelsAdapter } from './telegram-channels/adapter.js';

const adapterClasses: Record<string, new () => SourceAdapter> = {
  'dom-com-cy': DomComCyAdapter,
  'bazaraki': BazarakiAdapter,
  'home-cy': HomeCyAdapter,
  'index-cy': IndexCyAdapter,
  'buysellcyprus': BuySellCyprusAdapter,
  'spitogatos-cy': SpitogatosCyAdapter,
  'online-properties': OnlinePropertiesAdapter,
  'rentals-cyprus': RentalsCyprusAdapter,
  'facebook-groups': FacebookGroupsAdapter,
  'telegram-channels': TelegramChannelsAdapter,
};

export function createAdapter(name: string): SourceAdapter {
  const AdapterClass = adapterClasses[name];
  if (!AdapterClass) {
    throw new Error(`Unknown adapter: ${name}. Available: ${Object.keys(adapterClasses).join(', ')}`);
  }
  return new AdapterClass();
}

export function getAvailableAdapters(): string[] {
  return Object.keys(adapterClasses);
}
