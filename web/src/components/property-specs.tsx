import { MapPin, Bed, Bath, Maximize, Home, Armchair, Calendar, Globe } from 'lucide-react';
import type { Listing } from '@/lib/api';

interface PropertySpecsProps {
  listing: Listing;
}

interface SpecItem {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function PropertySpecs({ listing }: PropertySpecsProps) {
  const specs: SpecItem[] = [];

  if (listing.location) {
    specs.push({
      icon: <MapPin className="w-4 h-4" />,
      label: 'Location',
      value: listing.location,
    });
  }
  if (listing.bedrooms != null) {
    specs.push({
      icon: <Bed className="w-4 h-4" />,
      label: 'Bedrooms',
      value: `${listing.bedrooms}`,
    });
  }
  if (listing.bathrooms != null) {
    specs.push({
      icon: <Bath className="w-4 h-4" />,
      label: 'Bathrooms',
      value: `${listing.bathrooms}`,
    });
  }
  if (listing.area_sqm != null) {
    specs.push({
      icon: <Maximize className="w-4 h-4" />,
      label: 'Area',
      value: `${listing.area_sqm} m\u00B2`,
    });
  }
  if (listing.property_type) {
    specs.push({
      icon: <Home className="w-4 h-4" />,
      label: 'Property Type',
      value: listing.property_type.charAt(0).toUpperCase() + listing.property_type.slice(1),
    });
  }
  if (listing.furnished != null) {
    specs.push({
      icon: <Armchair className="w-4 h-4" />,
      label: 'Furnished',
      value: listing.furnished ? 'Yes' : 'No',
    });
  }
  if (listing.district) {
    specs.push({
      icon: <Globe className="w-4 h-4" />,
      label: 'District',
      value: listing.district.charAt(0).toUpperCase() + listing.district.slice(1),
    });
  }
  if (listing.listing_date) {
    specs.push({
      icon: <Calendar className="w-4 h-4" />,
      label: 'Listed',
      value: new Date(listing.listing_date).toLocaleDateString(),
    });
  }

  if (specs.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {specs.map((spec) => (
        <div
          key={spec.label}
          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
        >
          <span className="text-gray-400">{spec.icon}</span>
          <div>
            <div className="text-xs text-gray-500">{spec.label}</div>
            <div className="text-sm font-medium">{spec.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
