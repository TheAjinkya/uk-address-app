import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
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
import { Address } from '../../models/address.model';
import { environment } from '../../../../../environments/environment';
import { PostcodeApiService } from '../../../../core/services/postcode-api';
import { HighlightPipe } from '../../../../shared/pipes/highlight-pipe';
import { LoadingSpinner } from "../../../../shared/components/loading-spinner/loading-spinner";
import { ErrorMessage } from "../../../../shared/components/error-message/error-message";

@Component({
  standalone: true,
  selector: 'app-address-search',
  templateUrl: './address-search.html',
  styleUrls: ['./address-search.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatListModule,
    HighlightPipe,
    LoadingSpinner,
    ErrorMessage
]
})
export class AddressSearch implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  searchForm: FormGroup;
  suggestions$!: Observable<string[]>;
  selectedAddress$: BehaviorSubject<Address | null> = new BehaviorSubject<Address | null>(null);
  loading$ = new BehaviorSubject<boolean>(false);
  error$ = new BehaviorSubject<string | null>(null);
  
  nearbyAddresses$: Observable<Address[]> | null = null;
  
  constructor(private postcodeApiService: PostcodeApiService) {
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
        
        return this.postcodeApiService.autocomplete(value, 10).pipe(
          catchError(err => {
            this.error$.next(err.message);
            return [];
          })
        );
      }),
      map(suggestions => {
        this.loading$.next(false);
        return suggestions;
      }),
      takeUntil(this.destroy$)
    );
  }

  private setupNearbySearch(): void {
    this.nearbyAddresses$ = this.selectedAddress$.pipe(
      filter(address => address !== null),
      switchMap(address => 
        this.postcodeApiService.getNearbyPostcodes(address!.postcode, 5)
      ),
      catchError(() => []),
      takeUntil(this.destroy$)
    );
  }

  onPostcodeSelected(postcode: string): void {
    this.loading$.next(true);
    this.error$.next(null);

    this.postcodeApiService.getPostcode(postcode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (address) => {
          this.loading$.next(false);
          if (address) {
            this.selectedAddress$.next(address);
            this.searchForm.patchValue({ postcode: address.postcode });
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
    this.selectedAddress$.next(null);
    this.error$.next(null);
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
          ).pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (addresses) => {
              this.loading$.next(false);
              if (addresses.length > 0) {
                this.selectedAddress$.next(addresses[0]);
                this.searchForm.patchValue({ postcode: addresses[0].postcode });
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}