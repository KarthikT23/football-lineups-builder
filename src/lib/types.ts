export type TeamId = 1 | 2;

export type SquadSize = 5 | 6 | 7 | 8;

export interface Player {
  id: string;
  team: TeamId;
  number: string;
  name: string;
  role: string; // e.g. GK, CB, LB, RB, DM, AM, LM, RM, CF, LW, RW — or a custom locked tag
  x: number; // 0..1 across the pitch width
  y: number; // 0..1 down the pitch height (0 = team 2's goal line, 1 = team 1's goal line)
  photoUrl?: string; // object URL for an uploaded square photo, replaces the jersey entirely
  captain?: boolean;
}

export interface TeamConfig {
  name: string;
  color: string;
  size: SquadSize;
  formationIndex: number; // which of FORMATION_OPTIONS[size] this team is currently using
}

export interface TeamsState {
  1: TeamConfig;
  2: TeamConfig;
}
