export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8010";

export interface Team {
  id: number;
  name: string;
  logo: string | null;
}

export interface Prediction {
  fixture_id: number;
  model_version: string;
  ts: string;
  pred_home_goals: number;
  pred_away_goals: number;
  p_home_win: number;
  p_draw: number;
  p_away_win: number;
  p_over25: number;
  p_btts: number;
  likely_scoreline: string;
  is_live: boolean;
  is_locked: boolean;
}

export interface Fixture {
  id: number;
  league_id: number;
  season: number;
  date: string;
  status: string;
  minute: number | null;
  home_goals: number | null;
  away_goals: number | null;
  is_featured: boolean;
  home: Team;
  away: Team;
  prediction: Prediction | null;
}

export interface League {
  id: number;
  name: string;
}

export interface AccuracyPoint {
  period: string;
  n: number;
  outcome_acc: number;
  scoreline_acc: number;
  over25_acc: number;
  btts_acc: number;
  brier: number;
}

export interface Accuracy {
  total_evaluated: number;
  overall_outcome_acc: number | null;
  points: AccuracyPoint[];
}

export interface FormEntry {
  fixture_id: number;
  date: string;
  opponent: string;
  home: boolean;
  goals_for: number;
  goals_against: number;
  result: "W" | "D" | "L";
}

export interface TeamForm {
  team: Team;
  attack: number | null;
  defense: number | null;
  recent: FormEntry[];
}

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);

export const isLive = (f: Fixture) => LIVE_STATUSES.has(f.status);
export const isFinished = (f: Fixture) =>
  ["FT", "AET", "PEN"].includes(f.status);

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export interface MarketItem {
  label: string;
  prob: number;
}

export interface MarketGroup {
  name: string;
  markets: MarketItem[];
}

export interface Markets {
  fixture_id: number;
  model_version: string;
  groups: MarketGroup[];
}

export interface BballTeam {
  id: number;
  name: string;
  logo: string | null;
}

export interface BballPrediction {
  exp_home_pts: number;
  exp_away_pts: number;
  exp_total: number;
  p_home_win: number;
  p_away_win: number;
}

export interface BballGame {
  id: number;
  league_id: number;
  league_name: string;
  date: string;
  status: string;
  home: BballTeam;
  away: BballTeam;
  home_pts: number | null;
  away_pts: number | null;
  prediction: BballPrediction | null;
}

export const fetchLeagues = () => get<League[]>("/leagues");
export const fetchFixtures = (league?: number) =>
  get<Fixture[]>(`/fixtures${league ? `?league=${league}` : ""}`);
export const fetchFixture = (id: number) => get<Fixture>(`/fixtures/${id}`);
export const fetchPrediction = (id: number) =>
  get<Prediction>(`/fixtures/${id}/prediction`);
export const fetchAccuracy = () => get<Accuracy>("/accuracy");
export const fetchTeamForm = (id: number) => get<TeamForm>(`/teams/${id}/form`);
export const fetchMarkets = (id: number) => get<Markets>(`/fixtures/${id}/markets`);
export const fetchBballLeagues = () => get<League[]>("/basketball/leagues");
export const fetchBballGames = (league?: number) =>
  get<BballGame[]>(`/basketball/games${league ? `?league=${league}` : ""}`);
