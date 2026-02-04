import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, map, Observable, of, retry, shareReplay, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { CacheService } from './cache.service';
import { Address, AutocompleteResponse, PostcodeApiResponse, PostcodeResult } from '../../features/address-search/models/address.model';

@Injectable({
  providedIn: 'root',
})

export class PostcodeApiService {
  private readonly baseUrl = environment.apiEndpoints.postcodes;
  private inFlightRequests = new Map<string, Observable<any>>();

  constructor(
    private http: HttpClient,
    private cacheService: CacheService
  ) {}

  /**
   * Autocomplete postcode search
   */
  autocomplete(query: string, limit: number = 10): Observable<string[]> {
    const cacheKey = `autocomplete_${query}_${limit}`;
    
    // Check cache first
    const cached = this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      return of(cached);
    }

    // Check for in-flight request
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const params = new HttpParams()
      .set('limit', limit.toString());

    const request$ = this.http.get<AutocompleteResponse>(
      `${this.baseUrl}/postcodes/${encodeURIComponent(query)}/autocomplete`,
      { params }
    ).pipe(
      retry(2),
      map(response => {
        if (response.status === 200 && response.result) {
          return response.result;
        }
        return [];
      }),
      catchError(this.handleError),
      shareReplay(1),
      map(results => {
        // Cache the results
        this.cacheService.set(cacheKey, results);
        this.inFlightRequests.delete(cacheKey);
        return results;
      })
    );

    this.inFlightRequests.set(cacheKey, request$);
    return request$;
  }

  /**
   * Get detailed postcode information
   */
  getPostcode(postcode: string): Observable<Address | null> {
    const cleanPostcode = this.cleanPostcode(postcode);
    const cacheKey = `postcode_${cleanPostcode}`;

    // Check cache
    const cached = this.cacheService.get<Address>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.http.get<PostcodeApiResponse>(
      `${this.baseUrl}/postcodes/${encodeURIComponent(cleanPostcode)}`
    ).pipe(
      retry(2),
      map(response => {
        if (response.status === 200 && response.result) {
          const result = response.result as PostcodeResult;
          const address = this.mapToAddress(result);
          this.cacheService.set(cacheKey, address);
          return address;
        }
        return null;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Bulk postcode lookup
   */
  bulkLookup(postcodes: string[]): Observable<Address[]> {
    const cleanPostcodes = postcodes.map(p => this.cleanPostcode(p));

    return this.http.post<PostcodeApiResponse>(
      `${this.baseUrl}/postcodes`,
      { postcodes: cleanPostcodes }
    ).pipe(
      retry(2),
      map(response => {
        if (response.status === 200 && Array.isArray(response.result)) {
          return response.result
            .filter(item => item !== null)
            .map(item => this.mapToAddress(item));
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Reverse geocode - find nearest postcodes to coordinates
   */
  reverseGeocode(lat: number, lon: number, limit: number = 10): Observable<Address[]> {
    const params = new HttpParams()
      .set('lat', lat.toString())
      .set('lon', lon.toString())
      .set('limit', limit.toString());

    return this.http.get<PostcodeApiResponse>(
      `${this.baseUrl}/postcodes`,
      { params }
    ).pipe(
      retry(2),
      map(response => {
        if (response.status === 200 && Array.isArray(response.result)) {
          return response.result.map(item => this.mapToAddress(item));
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Validate postcode format
   */
  validatePostcode(postcode: string): Observable<boolean> {
    const cleanPostcode = this.cleanPostcode(postcode);

    return this.http.get<{ status: number; result: boolean }>(
      `${this.baseUrl}/postcodes/${encodeURIComponent(cleanPostcode)}/validate`
    ).pipe(
      retry(2),
      map(response => response.result),
      catchError(() => of(false))
    );
  }

  /**
   * Get random postcode (useful for testing)
   */
  getRandomPostcode(): Observable<Address | null> {
    return this.http.get<PostcodeApiResponse>(
      `${this.baseUrl}/random/postcodes`
    ).pipe(
      retry(2),
      map(response => {
        if (response.status === 200 && response.result) {
          return this.mapToAddress(response.result as PostcodeResult);
        }
        return null;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Search for postcodes near another postcode
   */
  getNearbyPostcodes(postcode: string, limit: number = 10): Observable<Address[]> {
    const cleanPostcode = this.cleanPostcode(postcode);

    return this.http.get<PostcodeApiResponse>(
      `${this.baseUrl}/postcodes/${encodeURIComponent(cleanPostcode)}/nearest`
    ).pipe(
      retry(2),
      map(response => {
        if (response.status === 200 && Array.isArray(response.result)) {
          return response.result
            .slice(0, limit)
            .map(item => this.mapToAddress(item));
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Map PostcodeResult to Address model
   */
  private mapToAddress(result: PostcodeResult): Address {
    return {
      postcode: result.postcode,
      line1: result.admin_ward || '',
      line2: result.parish || undefined,
      city: result.admin_district || '',
      county: result.admin_county || undefined,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude
    };
  }

  /**
   * Clean postcode string
   */
  private cleanPostcode(postcode: string): string {
    return postcode.replace(/\s+/g, '').toUpperCase();
  }

  /**
   * Centralized error handling
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 404:
          errorMessage = 'Postcode not found';
          break;
        case 400:
          errorMessage = 'Invalid postcode format';
          break;
        case 429:
          errorMessage = 'Too many requests. Please try again later';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later';
          break;
        default:
          errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}