import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { getJson, requestFirst, v1 } from './client';

export function listCountries(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/countries/'), { params });
}

export function listCities(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/cities/'), { params });
}

export function listCurrencies(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/currencies/'), { params });
}

export function listUniversities(params?: ApiParams) {
  return requestFirst<CollectionResponse<ApiListItem>>(
    [v1('/education/universities/'), '/api/client/v1/universities/'],
    (path) => getJson<CollectionResponse<ApiListItem>>(path, { params })
  );
}

export function getUniversity(id: EntityId) {
  return requestFirst<ApiListItem>(
    [v1(`/education/universities/${id}/`), `/api/client/v1/universities/${id}/`],
    (path) => getJson<ApiListItem>(path)
  );
}

export function listPrograms(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/programs/'), { params });
}

export function getProgram(id: EntityId) {
  return getJson<ApiListItem>(v1(`/education/programs/${id}/`));
}

export function listProgramFees(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/program-fees/'), { params });
}

export function listIntakes(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/intakes/'), { params });
}

export function listRequiredDocuments(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/required-documents/'), { params });
}

export function listUniversityContacts(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/education/university-contacts/'), { params });
}
