// Shared output checks: model labels and previous assistant text are not evidence.
const awayFromHouse = /från\s+(?:huset|fasaden)|væk\s+fra\s+(?:huset|facaden)|vom\s+(?:Haus|Gebäude)\s+weg|away\s+from\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
const towardsHouse = /mot\s+(?:huset|fasaden)|mod\s+(?:huset|facaden)|zum\s+(?:Haus|Gebäude)|(?:towards?|to)\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
export const reversesDrainage = (reply, rows) => rows.some(r => awayFromHouse.test(r.answer || '')) && towardsHouse.test(reply);
