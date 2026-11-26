import self from '../../../../docs/architecture/workspace.json?raw';
import cloudshop from '../../../../fixtures/json/custom/cloudshop-multi-system.json?raw';
import nova from '../../../../fixtures/json/custom/novabank-event-driven.json?raw';
import bank from '../../../../fixtures/json/upstream/big-bank-plc.json?raw';
import risk from '../../../../fixtures/json/upstream/financial-risk-system.json?raw';
import minimal from '../../../../fixtures/json/upstream/getting-started.json?raw';
import apacheLicense from '../../../../fixtures/dsl/upstream/LICENSE-Apache-2.0.txt?raw';
import type { Sample } from '../viewer';

export const samples: readonly Sample[] = [
  { id: 'cloudshop', name: 'CloudShop Multi-System', text: cloudshop },
  { id: 'bank', name: 'Big Bank plc (Structurizr Official)', text: bank, license: apacheLicense },
  { id: 'self', name: 'c4-zoom Architecture (Self)', text: self },
  { id: 'nova', name: 'NovaBank Event Mesh', text: nova },
  { id: 'risk', name: 'Financial Risk System', text: risk, license: apacheLicense },
  { id: 'minimal', name: 'Getting Started', text: minimal, license: apacheLicense },
];
