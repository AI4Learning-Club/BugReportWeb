export type PersonnelPatchBody = {
  ownerId?: string | null;
  addRelatedUserIds?: string[];
  removeRelatedUserIds?: string[];
};

export type PersonnelUser = {
  id: string;
  username: string;
  displayName: string;
};

export type PersonnelResponse = {
  owner: PersonnelUser | null;
  relatedUsers: PersonnelUser[];
};

export type EntityKind = 'bug' | 'feature';
