/**
 * The rule of lib/member/device-room.ts, pure: an account is full for a
 * machine when it has as many connected machines as its plan allows and the
 * asking machine is not already one of them. A machine that asks again (a new
 * login, a revalidation) keeps its place; a plan with no ceiling is never full.
 */
export function isRoomFull(connected: { deviceId: string }[], limit: number, deviceId: string | null): boolean {
  if (limit <= 0 || connected.length < limit) return false;
  return !(deviceId && connected.some((device) => device.deviceId === deviceId));
}
