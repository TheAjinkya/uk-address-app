import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { 
  debounceTime, 
  distinctUntilChanged, 
  switchMap, 
  filter,
  takeUntil,
  map,
  startWith,
  catchError
} from 'rxjs/operators';

// Material imports
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';

import { Address, PostcodeResult } from '../../models/address.model';
import { environment } from '../../../../../environments/environment';
import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { HighlightPipe } from '../../../../shared/pipes/highlight-pipe';
import { PostcodeApiService } from '../../../../core/services/postcode-api';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient, HttpParams } from '@angular/common/http';

@Component({
  selector: 'app-address-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatCardModule,
    MatListModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    LoadingSpinner,
    ErrorMessage,
    HighlightPipe
  ],
  templateUrl: './address-search.html',
  styleUrls: ['./address-search.scss']
})
export class AddressSearch implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  searchForm: FormGroup;
  suggestions$!: Observable<string[]>;
  selectedPostcode$: BehaviorSubject<PostcodeResult | null> = new BehaviorSubject<PostcodeResult | null>(null);
  loading$ = new BehaviorSubject<boolean>(false);
  error$ = new BehaviorSubject<string | null>(null);
  
  nearbyPostcodes$: Observable<PostcodeResult[]> | null = null;
  suggestionCount$ = new BehaviorSubject<number>(0);
  
  constructor(private postcodeApiService: PostcodeApiService, private http: HttpClient) {
    this.searchForm = new FormGroup({
      postcode: new FormControl('', [
        Validators.required,
        Validators.pattern(/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i)
      ])
    });
  }

  ngOnInit(): void {
    this.setupAutocomplete();
    this.setupNearbySearch();
  }

  private setupAutocomplete(): void {
    const postcodeControl = this.searchForm.get('postcode')!;

    this.suggestions$ = postcodeControl.valueChanges.pipe(
      startWith(''),
      debounceTime(environment.debounceTime),
      distinctUntilChanged(),
      filter(value => typeof value === 'string' && value.length >= environment.minSearchLength),
      switchMap(value => {
        this.loading$.next(true);
        this.error$.next(null);
        
        // Remove limit to get ALL suggestions
        return this.postcodeApiService.autocomplete(value).pipe(
          catchError(err => {
            this.error$.next(err.message);
            return [];
          })
        );
      }),
      map(suggestions => {
        this.loading$.next(false);
        this.suggestionCount$.next(suggestions.length);
        return suggestions;
      }),
      takeUntil(this.destroy$)
    );
  }

  private setupNearbySearch(): void {
    this.nearbyPostcodes$ = this.selectedPostcode$.pipe(
      filter(postcode => postcode !== null),
      switchMap(postcode => {
        const params = new HttpParams()
          .set('lat', postcode!.latitude.toString())
          .set('lon', postcode!.longitude.toString())
          .set('limit', '5');
        
        return this.http.get<any>(
          `${environment.apiEndpoints.postcodes}/postcodes`,
          { params }
        ).pipe(
          map(response => response.result || []),
          catchError(() => [])
        );
      }),
      takeUntil(this.destroy$)
    );
  }

  onPostcodeSelected(postcode: string): void {
    this.loading$.next(true);
    this.error$.next(null);

    this.postcodeApiService.getPostcode(postcode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (postcodeData) => {
          this.loading$.next(false);
          if (postcodeData) {
            this.selectedPostcode$.next(postcodeData);
            this.searchForm.patchValue({ postcode: postcodeData.postcode });
          } else {
            this.error$.next('Postcode not found');
          }
        },
        error: (err) => {
          this.loading$.next(false);
          this.error$.next(err.message);
        }
      });
  }

  onSubmit(): void {
    if (this.searchForm.valid) {
      const postcode = this.searchForm.get('postcode')?.value;
      this.onPostcodeSelected(postcode);
    }
  }

  clearSearch(): void {
    this.searchForm.reset();
    this.selectedPostcode$.next(null);
    this.error$.next(null);
    this.suggestionCount$.next(0);
  }

  useCurrentLocation(): void {
    if ('geolocation' in navigator) {
      this.loading$.next(true);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.postcodeApiService.reverseGeocode(
            position.coords.latitude,
            position.coords.longitude,
            1
          ).pipe(
            takeUntil(this.destroy$),
            switchMap(addresses => {
              if (addresses.length > 0) {
                return this.postcodeApiService.getPostcode(addresses[0].postcode);
              }
              throw new Error('No postcode found');
            })
          )
          .subscribe({
            next: (postcodeData) => {
              this.loading$.next(false);
              if (postcodeData) {
                this.selectedPostcode$.next(postcodeData);
                this.searchForm.patchValue({ postcode: postcodeData.postcode });
              }
            },
            error: (err) => {
              this.loading$.next(false);
              this.error$.next('Unable to find postcode for your location');
            }
          });
        },
        (error) => {
          this.loading$.next(false);
          this.error$.next('Unable to access location');
        }
      );
    } else {
      this.error$.next('Geolocation is not supported by your browser');
    }
  }

  getQualityColor(quality: number): string {
    if (quality >= 9) return 'primary';
    if (quality >= 7) return 'accent';
    return 'warn';
  }

  getQualityText(quality: number): string {
    if (quality >= 9) return 'Excellent';
    if (quality >= 7) return 'Good';
    if (quality >= 5) return 'Fair';
    return 'Poor';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}