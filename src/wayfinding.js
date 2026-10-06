import * as THREE from 'three';
import { ROOM_IDENTITY, identityOf, roomsVia, drawGlyph } from './room-identity.js';

/**
 * Door portals and deck gate markers. Every hatch face announces the room
 * beyond it in that room's colour and symbol; faces inside a department also
 * list the further rooms reached through that hatch.
 */
export function addWayfinding(ctx) {
  const { rooms, MODULES, LINKS, doors, kit, texture, textPlane, mat, beginModule, endSection } = ctx;
  const stats = { portalSigns: 0, jambLights: 0, gateMarkers: 0 };
  const room = id => rooms.find(r => r.id === id);
  const lights = Object.fromEntries(Object.entries(ROOM_IDENTITY).map(([id, { color }]) => {
    const m = mat({ color, emissive: color, emissiveIntensity: 1.1, roughness: .4 }); m.name = `Wayfinding / ${id} light`; return [id, m];
  }));
  const frameMaterial = ctx.materials.graphite;
  const viaCache = new Map(MODULES.map(m => [m.id, roomsVia(m.id)]));

  function chips(g, ids, x, y, h) {
    let cx = x;
    for (const id of ids) {
      const r = room(id), { color } = identityOf(id);
      g.fillStyle = color; g.fillRect(cx, y, h * 1.6, h);
      g.fillStyle = '#10181b'; g.font = `500 ${Math.round(h * .72)}px Space, Arial`; g.textAlign = 'center';
      g.fillText(r.number, cx + h * .8, y + h * .76); g.textAlign = 'left'; cx += h * 1.6 + 8;
    }
    return cx;
  }
  function portalSign(destId, viaIds) {
    const r = room(destId), { color, glyph, tagline } = identityOf(destId);
    const map = texture(1024, 228, (g, w, h) => {
      g.fillStyle = '#121a1e'; g.fillRect(0, 0, w, h);
      g.fillStyle = color; g.fillRect(0, 0, 214, h);
      g.fillStyle = '#10181b'; g.font = '500 112px Space, Arial'; g.textAlign = 'center'; g.fillText(r.number, 107, 150); g.textAlign = 'left';
      drawGlyph(g, glyph, 292, 112, 118, color, 8);
      g.fillStyle = '#f2f1e6'; g.font = '500 70px Space, Arial'; g.fillText(r.name.toUpperCase(), 382, 104, w - 410);
      if (viaIds.length) {
        g.fillStyle = '#9fb0aa'; g.font = '400 30px Space, Arial'; g.fillText('ALSO THIS WAY', 384, 170);
        chips(g, viaIds, 610, 140, 42);
      } else { g.fillStyle = '#9fb0aa'; g.font = '400 32px Space, Arial'; g.fillText(tagline.toUpperCase(), 384, 168, w - 410); }
      g.fillStyle = color; g.fillRect(214, h - 10, w - 214, 10);
    });
    map.userData.emissiveDisplay = true;
    return map;
  }
  function gateMarker(destId, viaIds) {
    const r = room(destId), { color, glyph } = identityOf(destId);
    const map = texture(1024, 448, (g, w, h) => {
      g.fillStyle = '#141b1e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = color; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
      // Chevrons point at the hatch, which lies beyond the top edge.
      g.fillStyle = color;
      for (const x of [110, w - 110]) for (const k of [0, 1]) { g.beginPath(); const y = 130 + k * 70; g.moveTo(x - 50, y + 40); g.lineTo(x, y - 10); g.lineTo(x + 50, y + 40); g.lineTo(x + 50, y + 62); g.lineTo(x, y + 12); g.lineTo(x - 50, y + 62); g.closePath(); g.fill(); }
      g.textAlign = 'center';
      g.font = '500 120px Space, Arial'; g.fillText(r.number, w / 2 - 150, 205);
      drawGlyph(g, glyph, w / 2 + 120, 160, 120, color, 9);
      g.fillStyle = '#f2f1e6'; g.font = '500 66px Space, Arial'; g.fillText(r.name.toUpperCase(), w / 2, 300, w - 300);
      if (viaIds.length) {
        g.fillStyle = '#9fb0aa'; g.font = '400 28px Space, Arial'; g.fillText('THROUGH HERE ALSO', w / 2, 352);
        const width = viaIds.length * (40 * 1.6 + 8) - 8; g.textAlign = 'left'; chips(g, viaIds, w / 2 - width / 2, 372, 40);
      }
      g.textAlign = 'left';
    });
    map.userData.emissiveDisplay = true;
    return map;
  }

  for (const door of doors) {
    const [linkId, endpoint] = [door.id.slice(0, door.id.lastIndexOf('-')), door.id.slice(door.id.lastIndexOf('-') + 1)];
    const link = LINKS.find(l => l.id === linkId), currentId = endpoint === 'a' ? link.from : link.to, otherId = endpoint === 'a' ? link.to : link.from;
    const current = MODULES.find(m => m.id === currentId), group = door.left.parent;
    const ry = door.axis === 'x' ? Math.PI / 2 : 0, normal = { x: Math.sin(ry), z: Math.cos(ry) };
    const intoModule = normal.x * (current.x - door.x) + normal.z * (current.z - door.z) > 0 ? 1 : -1;
    const bridge = door.variant === 'bridge';
    for (const face of [-1, 1]) {
      // A face looking into the module is read from inside it: it leads onward.
      const insideFace = face === intoModule, destId = insideFace ? otherId : currentId;
      const via = insideFace ? (viaCache.get(currentId)[otherId] || []).filter(id => id !== otherId) : [];
      // The command airlock already carries an oversized 07 / BRIDGE lintel.
      if (!bridge) {
        // Room side: a projecting header clears every hatch hood. Tube side:
        // lower and flush, under the tube's low service ceiling.
        const out = insideFace ? .45 : .252, y = insideFace ? 2.445 : 2.4;
        textPlane(portalSign(destId, via), 1.08, .24, 0, y, face * out, face > 0 ? 0 : Math.PI, group); stats.portalSigns++;
        kit.cuboid(0, y, face * (out - .012), 1.12, .27, .02, frameMaterial, 0, group);
        if (insideFace) for (const side of [-1, 1]) kit.cuboid(side * .42, y + .02, face * (out + .2) / 2, .035, .05, out - .2, frameMaterial, 0, group);
      }
      // Two light runs per jamb, broken around the existing latch boxes.
      const x = bridge ? 1.06 : 1.0, zz = face * (bridge ? .19 : .158);
      for (const side of [-1, 1]) for (const [y0, y1] of [[.42, 1.12], [1.55, 1.9]]) {
        kit.cuboid(side * x, (y0 + y1) / 2, zz, .028, y1 - y0, .012, lights[destId], 0, group); stats.jambLights++;
      }
      kit.cuboid(0, 2.31, face * (bridge ? .24 : .2), .9, .022, .012, lights[destId], 0, group);
      if (insideFace) {
        beginModule(current);
        const toDoor = { x: door.x - current.x, z: door.z - current.z }, along = door.axis === 'x' ? { x: Math.sign(toDoor.x), z: 0 } : { x: 0, z: Math.sign(toDoor.z) };
        const cx = door.x - along.x * 1.3, cz = door.z - along.z * 1.3;
        const marker = textPlane(gateMarker(destId, via), 1.3, .57, cx, current.elevation + .031, cz, 0);
        marker.rotation.order = 'YXZ'; marker.rotation.set(-Math.PI / 2, Math.atan2(-along.x, -along.z), 0);
        marker.position.y = .031; marker.renderOrder = 1;
        marker.material.polygonOffset = true; marker.material.polygonOffsetFactor = -2; marker.material.polygonOffsetUnits = -2;
        endSection(); stats.gateMarkers++;
      }
    }
  }
  return stats;
}
