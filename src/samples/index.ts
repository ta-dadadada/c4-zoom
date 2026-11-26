import cloudshop from '../../fixtures/dsl/custom/cloudshop-multi-system.dsl?raw';
import nova from '../../fixtures/dsl/custom/novabank-event-driven.dsl?raw';
import bank from '../../fixtures/dsl/upstream/big-bank-plc.dsl?raw';
import minimal from '../../fixtures/dsl/upstream/getting-started.dsl?raw';
import apacheLicense from '../../fixtures/dsl/upstream/LICENSE-Apache-2.0.txt?raw';

export const samples = [
  { id: 'cloudshop', name: 'CloudShop Multi-System', text: cloudshop },
  { id: 'bank', name: 'Big Bank plc', text: bank, license: apacheLicense },
  { id: 'nova', name: 'NovaBank Event Mesh', text: nova },
  { id: 'minimal', name: 'Getting Started', text: minimal, license: apacheLicense },
] as const;

export const defaultSample = samples[0];
