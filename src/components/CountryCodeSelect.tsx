import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import {
  AE,
  AR,
  AT,
  AU,
  BD,
  BE,
  BR,
  CA,
  CH,
  CL,
  CN,
  CO,
  CZ,
  DE,
  DK,
  DZ,
  EG,
  ES,
  FI,
  FR,
  GB,
  GR,
  HU,
  ID,
  IN,
  IT,
  JP,
  KE,
  KH,
  KR,
  MA,
  MX,
  MY,
  NG,
  NL,
  NO,
  NZ,
  PE,
  PH,
  PK,
  PL,
  PT,
  QA,
  RO,
  SA,
  SE,
  SG,
  TH,
  UG,
  US,
  UY,
  ZA,
} from 'country-flag-icons/react/3x2';
import { fastSportTokens } from '@/theme/tokens';

type FlagComponent = typeof ZA;

export interface PhoneCountry {
  iso: string;
  code: string;
  name: string;
  Flag: FlagComponent;
}

// Why: flags are SVGs because Windows doesn't draw flag emoji (it shows the letters "ZA").
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'ZA', code: '+27', name: 'South Africa', Flag: ZA },
  { iso: 'US', code: '+1', name: 'United States', Flag: US },
  { iso: 'CA', code: '+1', name: 'Canada', Flag: CA },
  { iso: 'GB', code: '+44', name: 'United Kingdom', Flag: GB },
  { iso: 'AU', code: '+61', name: 'Australia', Flag: AU },
  { iso: 'NZ', code: '+64', name: 'New Zealand', Flag: NZ },
  { iso: 'NG', code: '+234', name: 'Nigeria', Flag: NG },
  { iso: 'KE', code: '+254', name: 'Kenya', Flag: KE },
  { iso: 'UG', code: '+256', name: 'Uganda', Flag: UG },
  { iso: 'MA', code: '+212', name: 'Morocco', Flag: MA },
  { iso: 'DZ', code: '+213', name: 'Algeria', Flag: DZ },
  { iso: 'EG', code: '+20', name: 'Egypt', Flag: EG },
  { iso: 'AE', code: '+971', name: 'United Arab Emirates', Flag: AE },
  { iso: 'SA', code: '+966', name: 'Saudi Arabia', Flag: SA },
  { iso: 'QA', code: '+974', name: 'Qatar', Flag: QA },
  { iso: 'KH', code: '+855', name: 'Cambodia', Flag: KH },
  { iso: 'CN', code: '+86', name: 'China', Flag: CN },
  { iso: 'JP', code: '+81', name: 'Japan', Flag: JP },
  { iso: 'KR', code: '+82', name: 'South Korea', Flag: KR },
  { iso: 'SG', code: '+65', name: 'Singapore', Flag: SG },
  { iso: 'MY', code: '+60', name: 'Malaysia', Flag: MY },
  { iso: 'TH', code: '+66', name: 'Thailand', Flag: TH },
  { iso: 'ID', code: '+62', name: 'Indonesia', Flag: ID },
  { iso: 'PH', code: '+63', name: 'Philippines', Flag: PH },
  { iso: 'IN', code: '+91', name: 'India', Flag: IN },
  { iso: 'BD', code: '+880', name: 'Bangladesh', Flag: BD },
  { iso: 'PK', code: '+92', name: 'Pakistan', Flag: PK },
  { iso: 'FR', code: '+33', name: 'France', Flag: FR },
  { iso: 'DE', code: '+49', name: 'Germany', Flag: DE },
  { iso: 'IT', code: '+39', name: 'Italy', Flag: IT },
  { iso: 'ES', code: '+34', name: 'Spain', Flag: ES },
  { iso: 'NL', code: '+31', name: 'Netherlands', Flag: NL },
  { iso: 'BE', code: '+32', name: 'Belgium', Flag: BE },
  { iso: 'CH', code: '+41', name: 'Switzerland', Flag: CH },
  { iso: 'AT', code: '+43', name: 'Austria', Flag: AT },
  { iso: 'DK', code: '+45', name: 'Denmark', Flag: DK },
  { iso: 'SE', code: '+46', name: 'Sweden', Flag: SE },
  { iso: 'NO', code: '+47', name: 'Norway', Flag: NO },
  { iso: 'FI', code: '+358', name: 'Finland', Flag: FI },
  { iso: 'PL', code: '+48', name: 'Poland', Flag: PL },
  { iso: 'CZ', code: '+420', name: 'Czech Republic', Flag: CZ },
  { iso: 'RO', code: '+40', name: 'Romania', Flag: RO },
  { iso: 'HU', code: '+36', name: 'Hungary', Flag: HU },
  { iso: 'GR', code: '+30', name: 'Greece', Flag: GR },
  { iso: 'PT', code: '+351', name: 'Portugal', Flag: PT },
  { iso: 'BR', code: '+55', name: 'Brazil', Flag: BR },
  { iso: 'AR', code: '+54', name: 'Argentina', Flag: AR },
  { iso: 'CL', code: '+56', name: 'Chile', Flag: CL },
  { iso: 'CO', code: '+57', name: 'Colombia', Flag: CO },
  { iso: 'PE', code: '+51', name: 'Peru', Flag: PE },
  { iso: 'UY', code: '+598', name: 'Uruguay', Flag: UY },
  { iso: 'MX', code: '+52', name: 'Mexico', Flag: MX },
];

/**
 * Why: Looks up a phone country by ISO code, falling back to South Africa.
 * @param iso - The ISO code, e.g. `ZA`.
 * @returns The matching country.
 */
export function findPhoneCountry(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? PHONE_COUNTRIES[0]!;
}

/**
 * Why: Picks the country for a saved dialling code. Profiles store only the code, so a shared
 * code (+1) resolves to the first country listed with it.
 * @param code - The dialling code, e.g. `+27`.
 * @returns The ISO code of the matching country, or `ZA`.
 * @example
 * isoForDialCode('+44'); // 'GB'
 */
export function isoForDialCode(code: string | null | undefined): string {
  return PHONE_COUNTRIES.find((country) => country.code === code)?.iso ?? 'ZA';
}

interface CountryCodeSelectProps {
  value: string;
  onChange: (iso: string) => void;
}

/**
 * Why: Dialling-code picker that shows each country's flag. The value is the ISO code, not the
 * dialling code, because the US and Canada share +1.
 * @param props - The selected ISO code and the change handler.
 * @returns The country code select.
 * @example
 * <CountryCodeSelect value="ZA" onChange={setCountryIso} />
 */
export default function CountryCodeSelect({ value, onChange }: CountryCodeSelectProps) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ 'aria-label': 'Country code' }}
      renderValue={(iso) => {
        const { Flag, code, name } = findPhoneCountry(iso);
        return (
          <span className="flex items-center gap-2">
            <Flag title={name} className="h-4 w-6 rounded-sm" />
            {code}
          </span>
        );
      }}
      MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320 } } } }}
      sx={{
        mt: 1,
        borderRadius: '24px',
        backgroundColor: fastSportTokens.colors.panelSubtle,
        fontSize: '0.875rem',
        '& .MuiSelect-select': { py: '12px', pl: '12px' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
      }}
    >
      {PHONE_COUNTRIES.map(({ iso, code, name, Flag }) => (
        <MenuItem key={iso} value={iso} sx={{ gap: 1.5, fontSize: '0.875rem' }}>
          <Flag title={name} className="h-4 w-6 rounded-sm" />
          <span className="flex-1">{name}</span>
          <span className="text-slate-500">{code}</span>
        </MenuItem>
      ))}
    </Select>
  );
}
