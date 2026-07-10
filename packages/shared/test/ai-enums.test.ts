import { describe, expect, it } from "vitest";

import {
  ALL_MAPS,
  CHEST_CONTENTS,
  DELIVER_PARCEL_IDS,
  DELIVER_RECIPIENT_IDS,
  deliverParcelIdSchema,
  deliverRecipientIdSchema,
  ESCORT_DESTINATION_IDS,
  ESCORT_DESTINATION_NAMES,
  ESCORT_DESTINATIONS,
  escortDestinationIdSchema,
  FETCH_TARGET_IDS,
  fetchTargetIdSchema,
  GATHER_CONTENTS,
  getMap,
  GIFTABLE_ITEM_IDS,
  giftableItemIdSchema,
  HUNT_TARGET_IDS,
  huntTargetIdSchema,
  isDeliverParcel,
  isDeliverRecipient,
  isEscortDestination,
  isFetchTarget,
  isGiftableItem,
  isHuntTarget,
  isSellable,
  isStreetEvent,
  isSurveyTarget,
  isWalkable,
  ITEMS,
  itemIdSchema,
  npcIdSchema,
  RESPAWNABLE_ENEMY_IDS,
  SHOP_STOCK,
  STREET_EVENT_IDS,
  STREET_EVENTS,
  streetEventIdSchema,
  SURVEY_TARGET_IDS,
  SURVEY_TARGET_NAMES,
  surveyTargetIdSchema,
  type ItemId
} from "../src/index.js";

describe("GiftableItemId(贈答ホワイトリスト)", () => {
  it("すべて既存 ItemId であり、消耗品(battleEffect 持ち)で、クエスト用でない", () => {
    for (const id of GIFTABLE_ITEM_IDS) {
      expect(itemIdSchema.safeParse(id).success).toBe(true);
      const def = ITEMS[id];
      expect(def.battleEffect).toBeDefined(); // 消耗品(回復・治療)であること
      expect(def.questItem).toBe(false);
    }
  });

  it("素材(herb/ore)・クエスト用(old-key)は含まない", () => {
    expect(GIFTABLE_ITEM_IDS).not.toContain("herb");
    expect(GIFTABLE_ITEM_IDS).not.toContain("ore");
    expect(GIFTABLE_ITEM_IDS).not.toContain("old-key");
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(giftableItemIdSchema.safeParse("potion-small").success).toBe(true);
    expect(giftableItemIdSchema.safeParse("herb").success).toBe(false);
    expect(isGiftableItem("antidote")).toBe(true);
    expect(isGiftableItem("old-key")).toBe(false);
  });
});

describe("HuntTargetId(討伐ホワイトリスト)", () => {
  // M10 で新雑魚(リスポーンする)を RESPAWNABLE へ追加したが、HuntTargetId は据え置いた
  // (game-design.md「敵バリエーション(拡張: M10)」/ 将来拡張)。よって両者はもはや一致せず、
  // HuntTargetId は RESPAWNABLE の「部分集合」であることを不変条件とする(hunt 対象は必ずリスポーンする)。
  it("HuntTargetId は RESPAWNABLE_ENEMY_IDS の部分集合(hunt 対象は必ずリスポーンする)", () => {
    for (const id of HUNT_TARGET_IDS) {
      expect(RESPAWNABLE_ENEMY_IDS).toContain(id);
    }
  });

  it("縦切りの HuntTargetId は既存3種のまま据え置き(M10 で不変)", () => {
    expect([...HUNT_TARGET_IDS].sort()).toEqual(["candle-eater", "creaking-doll", "mist-wolf"]);
  });

  it("M10 の新雑魚はリスポーンするが hunt 対象には含めない(据え置き)", () => {
    for (const id of ["wisp-flame", "whisper-mask", "rust-eater"] as const) {
      expect(RESPAWNABLE_ENEMY_IDS).toContain(id);
      expect(HUNT_TARGET_IDS as readonly string[]).not.toContain(id);
      expect(isHuntTarget(id)).toBe(false);
    }
  });

  it("ボス dream-eater・中ボス failing-spinner を含まない(リスポーンしない)", () => {
    for (const id of ["dream-eater", "failing-spinner"] as const) {
      expect(HUNT_TARGET_IDS as readonly string[]).not.toContain(id);
      expect(RESPAWNABLE_ENEMY_IDS).not.toContain(id);
      expect(huntTargetIdSchema.safeParse(id).success).toBe(false);
      expect(isHuntTarget(id)).toBe(false);
    }
    expect(isHuntTarget("mist-wolf")).toBe(true);
  });
});

describe("FetchTargetId(納品ホワイトリスト)", () => {
  const reobtainable = new Set<ItemId>();
  for (const id of SHOP_STOCK) reobtainable.add(id);
  for (const entries of Object.values(CHEST_CONTENTS)) {
    for (const e of entries) reobtainable.add(e.itemId);
  }
  for (const entries of Object.values(GATHER_CONTENTS)) {
    for (const e of entries) reobtainable.add(e.itemId);
  }

  it("すべて既存 ItemId かつ再入手経路(購入/宝箱/採取)を持ち、クエスト用でない", () => {
    for (const id of FETCH_TARGET_IDS) {
      expect(itemIdSchema.safeParse(id).success).toBe(true);
      expect(ITEMS[id].questItem).toBe(false);
      expect(reobtainable.has(id)).toBe(true);
    }
  });

  it("一点物クエストアイテム(old-key)は含まない", () => {
    expect(FETCH_TARGET_IDS).not.toContain("old-key");
    expect(fetchTargetIdSchema.safeParse("old-key").success).toBe(false);
    expect(isFetchTarget("herb")).toBe(true);
    expect(isFetchTarget("old-key")).toBe(false);
  });
});

describe("StreetEventId(街頭演出)", () => {
  it("3〜5種が定義され、各 ID に定義(name・text)がある", () => {
    expect(STREET_EVENT_IDS.length).toBeGreaterThanOrEqual(3);
    expect(STREET_EVENT_IDS.length).toBeLessThanOrEqual(5);
    for (const id of STREET_EVENT_IDS) {
      const def = STREET_EVENTS[id];
      expect(def.id).toBe(id);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.text.length).toBeGreaterThan(0);
    }
  });

  it("STREET_EVENTS のキー集合と STREET_EVENT_IDS が一致する", () => {
    expect(Object.keys(STREET_EVENTS).sort()).toEqual([...STREET_EVENT_IDS].sort());
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(streetEventIdSchema.safeParse("distant-bell").success).toBe(true);
    expect(streetEventIdSchema.safeParse("dragon").success).toBe(false);
    expect(isStreetEvent("peddler")).toBe(true);
    expect(isStreetEvent("dragon")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// M19: サブクエスト3型拡充のホワイトリスト(実在性ドリフト検知)
// ---------------------------------------------------------------------------

describe("DeliverRecipientId(配達の受取NPCホワイトリスト。M19)", () => {
  it("すべて実在 NpcId で、情報屋 informant を含まない(受注元への配達を防ぐ)", () => {
    for (const id of DELIVER_RECIPIENT_IDS) {
      expect(npcIdSchema.safeParse(id).success).toBe(true);
    }
    expect(DELIVER_RECIPIENT_IDS as readonly string[]).not.toContain("informant");
    expect(deliverRecipientIdSchema.safeParse("informant").success).toBe(false);
  });

  it("初期候補は innkeeper/merchant/priest/artisan(caretaker/warden は含めない)", () => {
    expect([...DELIVER_RECIPIENT_IDS].sort()).toEqual(["artisan", "innkeeper", "merchant", "priest"]);
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(isDeliverRecipient("innkeeper")).toBe(true);
    expect(isDeliverRecipient("informant")).toBe(false);
    expect(isDeliverRecipient("dragon")).toBe(false);
  });
});

describe("DeliverParcelId(配達の預かり品ホワイトリスト。M19)", () => {
  it("すべて実在 ItemId かつクエスト用(questItem)=売却/破棄不可", () => {
    for (const id of DELIVER_PARCEL_IDS) {
      expect(itemIdSchema.safeParse(id).success).toBe(true);
      expect(ITEMS[id].questItem).toBe(true);
      expect(isSellable(id)).toBe(false);
    }
  });

  it("一点物 old-key・贈答/納品ホワイトリストの品は含まない", () => {
    expect(DELIVER_PARCEL_IDS as readonly string[]).not.toContain("old-key");
    for (const id of DELIVER_PARCEL_IDS) {
      expect(GIFTABLE_ITEM_IDS as readonly string[]).not.toContain(id);
      expect(FETCH_TARGET_IDS as readonly string[]).not.toContain(id);
    }
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(isDeliverParcel("sealed-letter")).toBe(true);
    expect(deliverParcelIdSchema.safeParse("potion-small").success).toBe(false);
    expect(isDeliverParcel("old-key")).toBe(false);
  });
});

describe("EscortDestinationId(護衛の目的地ホワイトリスト。M19)", () => {
  it("各目的地の座標が該当マップで walkable(実在・通行可能)", () => {
    for (const id of ESCORT_DESTINATION_IDS) {
      const dest = ESCORT_DESTINATIONS[id];
      expect(isWalkable(getMap(dest.mapId), dest.position)).toBe(true);
    }
  });

  it("目的地は仕様の実在地点と一致する(town-gate/settlement-gate/field-crossroads)", () => {
    expect(ESCORT_DESTINATIONS["town-gate"]).toEqual({ mapId: "town", position: { x: 11, y: 13 } });
    expect(ESCORT_DESTINATIONS["settlement-gate"]).toEqual({ mapId: "settlement", position: { x: 8, y: 10 } });
    expect(ESCORT_DESTINATIONS["field-crossroads"]).toEqual({ mapId: "field", position: { x: 11, y: 8 } });
  });

  it("ESCORT_DESTINATIONS / ESCORT_DESTINATION_NAMES のキー集合が ID 列と一致(drift 検知)", () => {
    expect(Object.keys(ESCORT_DESTINATIONS).sort()).toEqual([...ESCORT_DESTINATION_IDS].sort());
    expect(Object.keys(ESCORT_DESTINATION_NAMES).sort()).toEqual([...ESCORT_DESTINATION_IDS].sort());
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(isEscortDestination("town-gate")).toBe(true);
    expect(escortDestinationIdSchema.safeParse("moon-gate").success).toBe(false);
  });
});

describe("SurveyTargetId(調査対象ホワイトリスト。M19)", () => {
  // 全マップの sign オブジェクト ID を集計(調べが無害・再実行可能な種のみ許可)
  const signIds = new Set<string>();
  const allObjectIds = new Set<string>();
  for (const map of ALL_MAPS) {
    for (const obj of map.objects) {
      allObjectIds.add(obj.id);
      if (obj.kind === "sign") signIds.add(obj.id);
    }
  }

  it("すべて実在オブジェクトID かつ kind=sign", () => {
    for (const id of SURVEY_TARGET_IDS) {
      expect(allObjectIds.has(id)).toBe(true);
      expect(signIds.has(id)).toBe(true);
    }
  });

  it("d4-conduit(実在の sign だが第2章トリガーのため除外)を含まない", () => {
    expect(signIds.has("d4-conduit")).toBe(true); // 実在の sign であること
    expect(SURVEY_TARGET_IDS as readonly string[]).not.toContain("d4-conduit");
    expect(surveyTargetIdSchema.safeParse("d4-conduit").success).toBe(false);
  });

  it("chest/gather 種は含まない(sign に限る)", () => {
    const allObjects = ALL_MAPS.flatMap((m) => m.objects);
    for (const id of SURVEY_TARGET_IDS) {
      expect(allObjects.find((o) => o.id === id)?.kind).toBe("sign");
    }
    // 宝箱・採取は survey 対象外
    expect(isSurveyTarget("d1-chest")).toBe(false);
    expect(isSurveyTarget("field-gather-herb")).toBe(false);
  });

  it("SURVEY_TARGET_NAMES のキー集合が ID 列と一致(drift 検知)", () => {
    expect(Object.keys(SURVEY_TARGET_NAMES).sort()).toEqual([...SURVEY_TARGET_IDS].sort());
  });

  it("スキーマ・型ガードが一致する", () => {
    expect(isSurveyTarget("field-sign-post")).toBe(true);
    expect(isSurveyTarget("d4-conduit")).toBe(false);
    expect(surveyTargetIdSchema.safeParse("moon-sign").success).toBe(false);
  });
});
