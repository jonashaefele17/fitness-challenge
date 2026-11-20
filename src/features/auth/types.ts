export interface InviteCheck {
  groupId: string;
  groupName: string;
}

export interface RedeemInviteInput {
  code: string;
  /** Required on the first redemption (creates the profile); ignored afterwards. */
  displayName?: string;
  homeGym?: string;
}
