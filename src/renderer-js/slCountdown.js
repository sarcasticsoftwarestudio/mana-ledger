// Released Secret Lair products whose exact cards live in Scryfall's separate
// SLC (Secret Lair Countdown) set instead of the normal SLD set. Keep these as
// explicit product contracts: SLC also contains bonus/chase rows that must not
// become guaranteed contents merely because they share the set code.

const card = (scryfallId, name, number, alternateScryfallIds = []) => ({
  mtgjsonUuid: null,
  identifiers: { scryfallId },
  scryfallId,
  alternateScryfallIds,
  name,
  number,
  finish: 'any',
  count: 1,
});

const countdown30Cards = [
  card('c535f7f8-a57e-4ef1-91b4-5e3281bd4407', 'Shivan Dragon', '1993'),
  card('c9eb1309-5e60-4b8f-b63c-ebe62030db5c', "Mishra's Factory", '1994'),
  card('7dae100a-ea1d-45f3-b47c-b278cda462ad', 'Necropotence', '1995'),
  card('9911cc02-ef9a-458b-94d2-50af92ad6628', "Lim-Dûl's Vault", '1996'),
  card('56b80bce-1ff6-40e7-bfdd-af1ffc1918c6', 'Tradewind Rider', '1997'),
  card('4e5b6e96-c1b8-44b8-90ab-2989e7463427', 'Smokestack', '1998'),
  card('6d6c51ea-21fd-46c2-9bdd-5f7b4438a1c3', 'Squee, Goblin Nabob', '1999'),
  card('4d8dd50e-576a-4e19-9ac2-a3d444a759f1', 'Lin Sivvi, Defiant Hero', '2000'),
  card('8476adaa-fd09-41c3-beda-0e2d654cb204', 'Wild Mongrel', '2001'),
  card('f9052ad9-a8b3-4fa3-8cbe-223b306c8328', 'Genesis', '2002'),
  card('e0d88029-2569-461b-a57d-1af10673f4cf', 'Chrome Mox', '2003'),
  card('23684d0f-c3c6-4b84-a5be-d6ca1085dae0', 'Glimpse of Nature', '2004'),
  card('6c542d42-e475-49d5-aeeb-be04d6e23646', 'Lightning Helix', '2005'),
  card('dbcdc29b-f84e-4ad4-a123-de578847a085', 'Bogardan Hellkite', '2006'),
  card('bf4e917c-e5ab-435f-99ba-efc77862add4', 'Ponder', '2007'),
  card('b2a6bfbc-24e9-4309-8490-0f0dbe74aae6', 'Heritage Druid', '2008'),
  card('35964154-94b0-4f3f-ae8f-b7f9e31118c8', 'Bloodbraid Elf', '2009'),
  card('cf7a1b53-09ed-4206-8de5-ead09883af2f', 'Sun Titan', '2010'),
  card('36df0c13-b7cb-44d6-85e1-17f2967a0f55', 'Birthing Pod', '2011'),
  card('9793f0a1-ab76-46e2-add2-200c2a9693b4', 'Deathrite Shaman', '2012'),
  card('9125f141-ee2c-4b9f-b9c1-9b9a779002d2', "Elspeth, Sun's Champion", '2013'),
  card('305fd0ae-c89c-4935-a072-a85928f497e3', 'Siege Rhino', '2014'),
  card('019728bc-7d37-4384-81e5-97c47660c092', 'Dragonlord Ojutai', '2015'),
  card('6150ba46-ab04-4906-8497-8c7441c52442', 'Thalia, Heretic Cathar', '2016'),
  card('fa553e54-e6aa-499b-ac48-0cdbf6c37734', 'Nicol Bolas, God-Pharaoh', '2017'),
  card('2793c505-6736-4259-b9c6-6f9369fd476f', 'Arclight Phoenix', '2018'),
  card('24e85f3d-a2f5-43ac-937a-ebb754de2f8a', 'Emry, Lurker of the Loch', '2019'),
  card('89df04da-741b-4f98-8c49-f7f0bc13df31', 'Shark Typhoon', '2020'),
  card('63fb443a-4023-4353-8060-c0db6b2c596b', 'Elite Spellbinder', '2021'),
  card('aedf907b-7d8e-4c6d-b3da-2aae1b327ee1', "Nashi, Moon Sage's Scion", '2022'),
];

const encyclopediaCards = [
  card('0d656542-f0cd-485d-9d74-05573a2d49e4', 'Altar of the Brood', '1', ['d44825dd-8126-4a4b-bcd5-c89ef63084e2']),
  card('a6382dfc-cadf-41da-ae42-0da9f98074b4', 'Brain Freeze', '2', ['6db339e8-1e48-4ad6-b536-bbbc41016038']),
  card('8894eed8-fc6b-4bc4-a8d0-daa628911967', 'Crop Rotation', '3', ['9077e683-27d6-4f8f-a852-2d0353688010']),
  card('4f2f0fda-592f-4420-9703-defa07ffa2dc', 'Demonic Consultation', '4', ['5dae1584-bd49-44e8-9f94-f98060752132']),
  card('9d96d034-7c69-4aec-835c-233cf941db70', 'Eerie Ultimatum', '5', ['8ed0f40a-7a06-4d13-8b66-260e1031c064']),
  card('1e1f470f-1194-4a87-ab6e-3574f5731642', 'Field of the Dead', '6', ['539f8465-aa73-4242-999e-3960f694b172']),
  card('d7655424-a6c9-4c90-bc27-b4b4c3d78d12', 'Gray Merchant of Asphodel', '7', ['aabe12dc-59b7-4245-8369-9bfc6304cda8']),
  card('028a52c2-d641-49a5-a93b-4c5d01e67234', 'Hymn to Tourach', '8', ['d94b9887-1a47-423c-bc81-fe57b4637e21']),
  card('d4f4ccdc-ffeb-4393-836d-f46204ad9b65', 'Isochron Scepter', '9', ['6e8beae7-f1ca-4f21-ada4-2e625657571b']),
  card('1050fea7-307b-47fb-94f4-36f5cb481b2b', 'Junji, the Midnight Sky', '10', ['c67bc57d-67fb-4da0-9d8f-0b1e5c9f4e83']),
  card('8146d912-d493-4a18-a59e-75f55276c7b5', 'Krark-Clan Ironworks', '11', ['f5b731dd-49ab-440b-b974-497e57122d4e']),
  card('eea9251b-ca83-420f-ac5f-4fc3ea8dc190', 'Llanowar Elves', '12', ['de7e17bc-9d4e-40c8-b8eb-a28882143d67']),
  card('14b4d558-11f2-46d0-8f25-d44f5e74f70c', 'Myrel, Shield of Argive', '13', ['a3ed5007-a574-45cd-bd33-444f7b84fdfb']),
  card('3efbd60f-f1c0-4657-b2e4-902086b061b6', "Narset's Reversal", '14', ['79122902-f80a-42a3-a907-493c67603c44']),
  card('c6c0bbd8-c428-4773-bd78-974d92f0e8bc', 'Ob Nixilis, the Fallen', '15', ['79e0fbea-1f35-4db8-a5b0-0b1c016f4946']),
  card('68875b43-6839-467c-909e-52fd2212b7de', 'Phyrexian Altar', '16', ['9890f538-0896-4814-8646-b29acc5852c7']),
  card('faf48a1c-e130-475a-8a45-db82bd950ab7', 'Questing Beast', '17', ['f56d40b1-db8a-4ce9-b8a3-7fc196031e34']),
  card('2ad34311-c7ef-4333-8978-f82d0dfe2836', 'Retrofitter Foundry', '18', ['5afffa6f-ae69-47c5-b79e-4a34f4acaf58']),
  card('193a5688-9e9b-48f4-9904-53134ec73c97', 'Sol Ring', '19', ['2f4e1e26-95cc-45bd-90e9-3ae00f1708cf']),
  card('1308603d-169b-4e26-96aa-05c2a5b5accd', 'Temple of the False God', '20', ['8264efcb-4265-4ad7-a9fb-9d5d636e6a3c']),
  card('e9a213c8-f9b5-4fcb-969c-b6c574810f21', "Urza's Saga", '21', ['3ec5d76d-58c0-4525-be90-b37f4a97e14c']),
  card('2671eaa1-e6d5-4b70-a36c-3c7765695f1b', 'Vesuva', '22', ['72a9faff-d54a-4996-822d-ef1323059e3a']),
  card('b673bf01-aed0-4d5b-bdd2-35dc8a162dc6', 'Wasteland', '23', ['96ad119e-d609-466b-8c2b-d540c3c11984']),
  card('9e919d80-093a-4b11-a78d-1ce2d038f8fc', 'Xantcha, Sleeper Agent', '24', ['1a3dd206-ac71-4e33-a326-5485a3308a4a']),
  card('f3b6a891-9206-4c7b-9331-fb652af9751f', 'Yarok, the Desecrated', '25', ['af247608-1935-4bb5-be13-20b7974a5245']),
  card('c9a27fc2-f9d4-4645-8d50-98a2bf2db1ef', 'Zo-Zu the Punisher', '26', ['09d43f17-cec1-4a2e-96d7-34e67f2d5fde']),
];

export const SL_COUNTDOWN_PRODUCTS = [
  {
    uuid: 'special:slc:2022-countdown',
    name: 'Secret Lair 30th Anniversary Countdown Kit',
    subtype: 'secret_lair_countdown',
    identifiers: { scryfallSetCode: 'slc' },
    dropName: '30th Anniversary Countdown Kit',
    legacyDrop: '30th Anniversary Countdown Kit',
    finishLabel: 'Variable finish',
    finish: 'mixed',
    variableFinish: true,
    tcgplayerProductId: null,
    releaseDate: '2022-11-01',
    msrp: 149.99,
    sourceUrl: 'https://magic.wizards.com/en/news/announcements/kicking-magics-30th-anniversary-celebration-2022-10-04',
    sourceLabel: 'Official Wizards contents + Scryfall SLC printings',
    lowConfidence: false,
    cards: countdown30Cards,
  },
  {
    uuid: 'special:slc:2025-encyclopedia',
    name: 'Secret Lair Countdown Kit: An Encyclopedia of Magic',
    subtype: 'secret_lair_countdown',
    identifiers: { scryfallSetCode: 'slc', tcgplayerProductId: '660745' },
    dropName: 'Secret Lair Countdown Kit: An Encyclopedia of Magic',
    legacyDrop: 'Secret Lair Countdown Kit: An Encyclopedia of Magic',
    finishLabel: 'Variable finish, with rare Halo foil variants',
    finish: 'mixed',
    variableFinish: true,
    tcgplayerProductId: '660745',
    releaseDate: '2025-11-03',
    msrp: 199.99,
    sourceUrl: 'https://magic.wizards.com/en/news/announcements/secret-lair-countdown-kit-an-encyclopedia-of-magic',
    sourceLabel: 'Official Wizards contents + Scryfall SLC printings',
    lowConfidence: false,
    cards: encyclopediaCards,
  },
];

export function mergeSlCountdownProducts(model = {}) {
  const existing = Array.isArray(model.products) ? model.products : [];
  const specialIds = new Set(SL_COUNTDOWN_PRODUCTS.map(p => p.uuid));
  const products = [...existing.filter(p => !specialIds.has(p.uuid)), ...SL_COUNTDOWN_PRODUCTS];
  const scryfallToName = { ...(model.scryfallToName || {}) };
  for (const product of SL_COUNTDOWN_PRODUCTS) {
    for (const c of product.cards) {
      scryfallToName[c.scryfallId] = c.name;
      for (const id of (c.alternateScryfallIds || [])) scryfallToName[id] = c.name;
    }
  }
  return { ...model, products, scryfallToName };
}

export function slCountdownGroupFor(drop) {
  const product = SL_COUNTDOWN_PRODUCTS.find(p => p.legacyDrop === drop);
  return product ? { superdrop: product.legacyDrop, date: product.releaseDate.slice(0, 7) } : null;
}
