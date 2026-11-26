import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDsl } from './parser';
import { lex } from './lexer';

const directory = new URL('../../../fixtures/dsl/', import.meta.url);
const fixture = (path: string) => readFileSync(new URL(path, directory), 'utf-8');
const validFixtures = [
  ...readdirSync(new URL('upstream/', directory))
    .filter((name) => name.endsWith('.dsl'))
    .map((name) => 'upstream/' + name),
  'custom/cloudshop-multi-system.dsl',
  'custom/novabank-event-driven.dsl',
  '../../docs/architecture/workspace.dsl',
];

describe('DSL', () => {
  it.each(validFixtures)('reads %s without losing declared relationships', (path) => {
    const { workspace, diagnostics } = parseDsl(fixture(path));
    expect(diagnostics.filter((diagnostic) => diagnostic.severity !== 'info')).toEqual([]);
    expect(workspace?.rootIds.length).toBeGreaterThan(0);
    for (const edge of workspace!.relationships) {
      expect(workspace!.elements[edge.sourceId]).toBeDefined();
      expect(workspace!.elements[edge.targetId]).toBeDefined();
    }
  });

  it('resolves local hierarchical aliases before global aliases', () => {
    const { workspace } = parseDsl(fixture('upstream/hierarchical-identifiers.dsl'));
    expect(workspace?.relationships.map(({ sourceId, targetId }) => [sourceId, targetId])).toEqual([
      ['b.c.d', 'b.c.a'],
    ]);
  });

  it('keeps this and groups transparent to symbol resolution', () => {
    const { workspace } = parseDsl(fixture('upstream/this.dsl'));
    expect(workspace?.relationships.map(({ sourceId, targetId }) => [sourceId, targetId])).toEqual([
      ['custom', 's'],
      ['custom', 's.c'],
      ['custom', 's.c.component'],
    ]);
    const nested = parseDsl(fixture('upstream/groups-nested.dsl')).workspace!;
    expect(nested.elements[nested.elements['a.a-api.api-endpoint']!.parentId!]?.name).toBe(
      'API Layer',
    );
    expect(nested.elements['a.a-api.api-endpoint']?.level).toBe(3);
  });

  it('applies metadata, implicit relationships, and case-insensitive keywords', () => {
    const { workspace, diagnostics } = parseDsl(`
      s = SoFtWaReSyStEm "System" {
        api = container "API" { TaG "Web,Core" "Web"; URL "https://example.com"; properties { Region "Tokyo" private true } }
        -> api "Calls" "HTTPS" { tags "Sync"; properties { port 443 } }
      }
    `);
    expect(diagnostics).toEqual([]);
    expect(workspace?.elements['s.api']).toMatchObject({
      tags: ['Web', 'Core'],
      url: 'https://example.com',
      properties: { Region: 'Tokyo', private: 'true' },
    });
    expect(workspace?.relationships[0]).toMatchObject({
      sourceId: 's',
      targetId: 's.api',
      tags: ['Sync'],
      technology: 'HTTPS',
      properties: { port: '443' },
    });
  });

  it('skips nested extensions and retains escaped quotes and braces in string values', () => {
    const petclinic = parseDsl(fixture('upstream/spring-petclinic.dsl'));
    expect(petclinic.workspace?.elements['springPetClinic.relationalDatabaseSchema']?.tags).toEqual(
      ['Relational Database Schema'],
    );
    expect(petclinic.diagnostics.some((item) => item.message.includes('!components'))).toBe(true);
    expect(lex('/* hi */ person "A\\"{}" # comment\r\n').tokens[1]).toMatchObject({
      kind: 'string',
      value: 'A"{}',
      start: { line: 1, column: 17 },
    });
  });

  it('skips adjacent comments and reserves hex colors for style statements', () => {
    const { workspace, diagnostics } = parseDsl(`
      workspace {
        model {
          a/* 宣言 */ = person "A" #bad
        }
        views { styles { element "Person" { color #fff } } }
      }
    `);
    expect(workspace?.elements.a?.description).toBeUndefined();
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'info' })]);
  });

  it('reports exact syntax and unresolved-reference positions', () => {
    const { workspace, diagnostics } = parseDsl(fixture('custom/invalid-syntax.dsl'));
    expect(workspace).toBeNull();
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', line: 12, column: 18 }),
        expect.objectContaining({ severity: 'error', line: 15, column: 1 }),
      ]),
    );
  });

  it('keeps mismatched links non-fatal and duplicate aliases distinct', () => {
    const { workspace, diagnostics } = parseDsl('a = person "A"\na = person "B"\na -> missing');
    expect(workspace?.rootIds).toEqual(['a', 'a~2']);
    expect(workspace?.relationships).toEqual([]);
    expect(diagnostics.map(({ severity }) => severity)).toEqual(['warning', 'warning']);
  });
});
