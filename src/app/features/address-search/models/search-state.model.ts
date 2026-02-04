import { Address } from "./address.model";

export interface SearchState {
  query: string;
  results: Address[];
  loading: boolean;
  error: string | null;
  selectedAddress: Address | null;
}