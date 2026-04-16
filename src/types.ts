export type CountryCode = 'DE' | 'GR' | 'FR' | 'HU';

export interface Country {
  name: string;
  color: string;
  systemInstruction: string;
}

export interface Proposal {
  borderControl: number;
  quotaMandatory: number;
  financialSupport: number;
}

export interface Message {
  role: 'mediator' | 'ai' | 'system';
  country?: CountryCode;
  content: string;
}

export type GameState = 'setup' | 'intro' | 'lab';
