// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'address-search',
    pathMatch: 'full'
  },
  {
    path: 'address-search',
    loadComponent: () => import('./features/address-search/components/address-search/address-search')
      .then(m => m.AddressSearch)
  }
];