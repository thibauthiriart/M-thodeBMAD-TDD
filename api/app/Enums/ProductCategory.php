<?php

namespace App\Enums;

enum ProductCategory: string
{
    case CPU = 'cpu';
    case GPU = 'gpu';
    case RAM = 'ram';
    case STOCKAGE = 'stockage';
    case CM = 'cm';
    case ALIMENTATION = 'alimentation';
    case BOITIER = 'boitier';
    case PERIPHERIQUES = 'peripheriques';

    /**
     * Get all enum values as an array.
     *
     * @return array<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Get French labels for each category.
     */
    public function label(): string
    {
        return match ($this) {
            self::CPU => 'CPU',
            self::GPU => 'GPU',
            self::RAM => 'RAM',
            self::STOCKAGE => 'Stockage',
            self::CM => 'Carte Mère',
            self::ALIMENTATION => 'Alimentation',
            self::BOITIER => 'Boîtier',
            self::PERIPHERIQUES => 'Périphériques',
        };
    }
}
