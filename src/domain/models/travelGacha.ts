import type { BaseEntity, EntityId, IsoDateString, IsoDateTimeString } from './common';
import type { CastleSeries } from './castle';
import type { JapanRegion } from './japanConquest';
import type { TripType } from './trip';

export type TravelGachaMode =
  | 'random'
  | 'condition'
  | 'unvisited'
  | 'wishlist'
  | 'castle'
  | 'nearby'
  | 'revisit'
  | 'omakase';

export type TravelGachaTransportMode =
  | 'walk'
  | 'bike'
  | 'train'
  | 'shinkansen'
  | 'bus'
  | 'car'
  | 'flight'
  | 'ship'
  | 'any';

export type TravelGachaRandomnessLevel = 'realistic' | 'balanced' | 'adventure' | 'chaos';
export type TravelGachaCandidateScope = 'all' | 'prefecture' | 'wishlist' | 'castle' | 'collection' | 'visited';
export type TravelGachaCandidateSource = 'prefecture' | 'wishlist' | 'castle' | 'collection' | 'past_trip';
export type TravelStyleTag = 'castle' | 'gourmet' | 'onsen' | 'nature' | 'city_walk' | 'photo' | 'history' | 'collection';
export type EstimatePrecision = 'exact' | 'high' | 'medium' | 'rough' | 'unknown';

export interface TravelGachaSettings {
  departureLabel: string;
  departurePrefectureCode?: string;
  departureDate?: IsoDateString;
  tripDurationDays: number;
  stayType: TripType;
  maxBudget?: number;
  maxOneWayTravelMinutes?: number;
  transportModes: TravelGachaTransportMode[];
  candidateScope: TravelGachaCandidateScope;
  travelStyleTags: TravelStyleTag[];
  regionCodes: JapanRegion[];
  prefectureCodes: string[];
  prioritizeUnvisited: boolean;
  prioritizeWishlist: boolean;
  includeVisited: boolean;
  includeRecentlyVisited: boolean;
  includeRecentlyDrawn: boolean;
  randomnessLevel: TravelGachaRandomnessLevel;
  candidateLimit: number;
}

export interface TravelCandidateCostEstimate {
  transportCost: number;
  accommodationCost: number;
  foodCost: number;
  activityCost: number;
  localTransportCost: number;
  contingencyCost: number;
  totalEstimatedCost: number;
  minTotalEstimatedCost: number;
  maxTotalEstimatedCost: number;
  estimatePrecision: EstimatePrecision;
  estimateReasons: string[];
}

export interface TravelCandidate {
  id: EntityId;
  sourceType: TravelGachaCandidateSource;
  sourceId: EntityId;
  name: string;
  description?: string;
  prefectureCode?: string;
  prefectureName?: string;
  regionCode?: JapanRegion;
  latitude?: number;
  longitude?: number;
  travelStyleTags: TravelStyleTag[];
  estimatedTravelTimeMinutes: number;
  recommendedTransportModes: TravelGachaTransportMode[];
  recommendedStayType: TripType;
  minimumRecommendedHours: number;
  isVisited: boolean;
  visitCount: number;
  lastVisitedAt?: IsoDateString;
  isWishlist: boolean;
  isFavorite: boolean;
  castleSeries?: CastleSeries;
  collectionIds: EntityId[];
  sourcePriority: number;
  eligibility: {
    eligible: boolean;
    rejectedReasons: string[];
    suggestions: string[];
  };
  costEstimate: TravelCandidateCostEstimate;
  score: number;
  scoreReasons: string[];
}

export interface TravelGachaDraw extends BaseEntity {
  mode: TravelGachaMode;
  settingsSnapshot: TravelGachaSettings;
  selectedCandidateId: EntityId;
  candidateSnapshot: TravelCandidate;
  candidateCount: number;
  score: number;
  scoreReasons: string[];
  drawnAt: IsoDateTimeString;
  acceptedAt?: IsoDateTimeString;
  rejectedAt?: IsoDateTimeString;
  rerolledFromDrawId?: EntityId;
  createdTripId?: EntityId;
}
