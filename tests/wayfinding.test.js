import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, LINKS } from '../src/layout.js';
import { ROOM_IDENTITY, roomsVia } from '../src/room-identity.js';

test('every department has a distinct wayfinding colour and symbol', () => {
  for (const m of MODULES) assert.ok(ROOM_IDENTITY[m.id], m.id);
  const colours = Object.values(ROOM_IDENTITY).map(i => i.color), glyphs = Object.values(ROOM_IDENTITY).map(i => i.glyph);
  assert.equal(new Set(colours).size, colours.length);
  assert.equal(new Set(glyphs).size, glyphs.length);
});

test('each hatch lists exactly the rooms reached through it', () => {
  for (const m of MODULES) {
    const via = roomsVia(m.id), neighbours = LINKS.filter(l => l.from === m.id || l.to === m.id).map(l => l.from === m.id ? l.to : l.from);
    assert.deepEqual(Object.keys(via).sort(), neighbours.sort(), `${m.id} hatches`);
    const reached = Object.values(via).flat();
    assert.equal(reached.length, MODULES.length - 1, `${m.id} reaches every other room once`);
    for (const n of neighbours) assert.equal(via[n][0], n, 'the neighbour itself is listed first');
  }
  // From the Arrival, everything lies beyond the Archive hatch.
  assert.equal(roomsVia('front-door').archive.length, 6);
  assert.deepEqual(roomsVia('forum').bridge, ['bridge']);
});
