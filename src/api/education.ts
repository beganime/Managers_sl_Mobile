import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, v1 } from './client';

export function listCountries(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/countries/'), { params });
}

export function listCities(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/cities/'), { params });
}

export function listUniversities(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/universities/'), { params });
}

export function listPrograms(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/programs/'), { params });
}
