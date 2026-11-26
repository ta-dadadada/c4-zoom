import { readBootstrap } from './bootstrap';
import { mount } from './mount';

mount({ mode: 'standalone', payload: readBootstrap(document) });
