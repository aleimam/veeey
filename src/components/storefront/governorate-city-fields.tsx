'use client';

import { useState } from 'react';
import { GOVERNORATES } from '@/lib/governorates';
import { CitySelect } from '@/components/storefront/city-select';
import type { CitiesByGovernorate } from '@/lib/city-service';

/**
 * Governorate + nested City, as a pair.
 *
 * The checkout form owns its own address state and wires these itself; this is
 * the drop-in version for the plain server-rendered forms (the account address
 * book), so both places nest the district the same way instead of one of them
 * quietly staying free text.
 */
export function GovernorateCityFields({
  cities,
  locale,
  labels,
  className,
  defaultGovernorate = '',
  defaultCity = '',
}: {
  cities: CitiesByGovernorate;
  locale: string;
  labels: {
    governorate: string;
    selectGovernorate: string;
    city: string;
    selectCity: string;
    cityOther: string;
    selectGovernorateFirst: string;
  };
  className: string;
  defaultGovernorate?: string;
  defaultCity?: string;
}) {
  const [governorate, setGovernorate] = useState(defaultGovernorate);
  const [city, setCity] = useState(defaultCity);

  return (
    <>
      <label className="block text-sm font-semibold text-ink">
        {labels.governorate}
        <select
          name="governorate"
          required
          value={governorate}
          onChange={(e) => {
            const gov = e.target.value;
            // Same rule as checkout: a district from the previous governorate is
            // not a valid address under the new one.
            const stillValid = (cities[gov] ?? []).some((c) => (locale === 'ar' ? c.nameAr : c.nameEn) === city);
            setGovernorate(gov);
            if (!stillValid) setCity('');
          }}
          className={className}
        >
          <option value="" disabled>{labels.selectGovernorate}</option>
          {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
        </select>
      </label>

      <CitySelect
        value={city}
        governorate={governorate}
        cities={cities}
        locale={locale}
        onChange={setCity}
        label={labels.city}
        chooseLabel={labels.selectCity}
        otherLabel={labels.cityOther}
        pickGovernorateFirstLabel={labels.selectGovernorateFirst}
        className={className}
      />
    </>
  );
}
