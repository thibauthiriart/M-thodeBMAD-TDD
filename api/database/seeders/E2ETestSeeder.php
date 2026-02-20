<?php

namespace Database\Seeders;

use App\Enums\ProductCategory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class E2ETestSeeder extends Seeder
{
    /**
     * Seed the E2E test data.
     *
     * Creates known users and products for Playwright E2E tests.
     * Uses updateOrCreate so it's safe to run multiple times (non-destructive).
     */
    public function run(): void
    {
        // Acheteur test user
        User::updateOrCreate(
            ['email' => 'e2e@test.com'],
            [
                'name' => 'E2E Test User',
                'password' => Hash::make('password'),
                'role' => 'acheteur',
                'email_verified_at' => now(),
            ]
        );

        // Vendeur test user (for Story 1.4 RBAC tests)
        $vendeur = User::updateOrCreate(
            ['email' => 'e2e-vendeur@test.com'],
            [
                'name' => 'E2E Vendeur User',
                'password' => Hash::make('password'),
                'role' => 'vendeur',
                'email_verified_at' => now(),
            ]
        );

        // Admin test user (for Story 1.4 RBAC tests)
        // Admin cannot self-register, must be seeded
        User::updateOrCreate(
            ['email' => 'e2e-admin@test.com'],
            [
                'name' => 'E2E Admin User',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'email_verified_at' => now(),
            ]
        );

        // ===================================================================
        // Story 3.2: Seed multi-seller products for catalogue tests
        // FR30: Products from multiple sellers mixed together
        // ===================================================================
        $this->seedCatalogProducts($vendeur);
    }

    /**
     * Seed catalogue products for Story 3.1 & 3.2 E2E tests.
     *
     * Creates multi-seller data:
     * - 4 sellers: HardwareShop, PCMaster, TechWorld, BonPrix
     * - 15 CPU products (2 pages at perPage=12)
     * - 5 GPU products (1 page, product IDs start at 101)
     * - 4 RAM products (1 page)
     * - 1 inactive CPU product (is_active = false)
     * - Products in all other categories for completeness
     */
    private function seedCatalogProducts(User $vendeur): void
    {
        // Create 4 named seller accounts (FR30: multi-seller)
        $sellers = [
            'HardwareShop' => User::updateOrCreate(
                ['email' => 'seller-hardwareshop@test.com'],
                [
                    'name' => 'HardwareShop',
                    'password' => Hash::make('password'),
                    'role' => 'vendeur',
                    'email_verified_at' => now(),
                ]
            ),
            'PCMaster' => User::updateOrCreate(
                ['email' => 'seller-pcmaster@test.com'],
                [
                    'name' => 'PCMaster',
                    'password' => Hash::make('password'),
                    'role' => 'vendeur',
                    'email_verified_at' => now(),
                ]
            ),
            'TechWorld' => User::updateOrCreate(
                ['email' => 'seller-techworld@test.com'],
                [
                    'name' => 'TechWorld',
                    'password' => Hash::make('password'),
                    'role' => 'vendeur',
                    'email_verified_at' => now(),
                ]
            ),
            'BonPrix' => User::updateOrCreate(
                ['email' => 'seller-bonprix@test.com'],
                [
                    'name' => 'BonPrix',
                    'password' => Hash::make('password'),
                    'role' => 'vendeur',
                    'email_verified_at' => now(),
                ]
            ),
        ];

        // ─── CPU products (14 active here + 1 at ID=101 = 15 active total + 1 inactive) ──
        $cpuProducts = [
            ['name' => 'AMD Ryzen 9 7950X', 'description' => 'Processeur 16 coeurs / 32 threads', 'price' => 549.99, 'stock_quantity' => 12, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'Intel Core i9-14900K', 'description' => 'Processeur 24 coeurs / 32 threads', 'price' => 589.00, 'stock_quantity' => 8, 'seller' => 'PCMaster', 'is_active' => true],
            ['name' => 'AMD Ryzen 7 7800X3D', 'description' => 'Processeur gaming 8 coeurs / 16 threads', 'price' => 399.99, 'stock_quantity' => 25, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'Intel Core i7-14700K', 'description' => 'Processeur 20 coeurs / 28 threads', 'price' => 419.00, 'stock_quantity' => 15, 'seller' => 'TechWorld', 'is_active' => true],
            ['name' => 'AMD Ryzen 5 7600X', 'description' => 'Processeur 6 coeurs / 12 threads', 'price' => 229.99, 'stock_quantity' => 30, 'seller' => 'PCMaster', 'is_active' => true],
            ['name' => 'Intel Core i5-14600K', 'description' => 'Processeur 14 coeurs / 20 threads', 'price' => 299.00, 'stock_quantity' => 0, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'AMD Ryzen 9 7900X', 'description' => 'Processeur 12 coeurs / 24 threads', 'price' => 449.99, 'stock_quantity' => 5, 'seller' => 'TechWorld', 'is_active' => true],
            ['name' => 'Intel Core i9-13900K', 'description' => 'Processeur 24 coeurs / 32 threads', 'price' => 499.00, 'stock_quantity' => 3, 'seller' => 'PCMaster', 'is_active' => true],
            ['name' => 'AMD Ryzen 5 5600X', 'description' => 'Processeur 6 coeurs / 12 threads', 'price' => 149.99, 'stock_quantity' => 50, 'seller' => 'BonPrix', 'is_active' => true],
            ['name' => 'Intel Core i3-14100', 'description' => 'Processeur 4 coeurs / 8 threads', 'price' => 129.00, 'stock_quantity' => 40, 'seller' => 'BonPrix', 'is_active' => true],
            ['name' => 'AMD Ryzen 7 5800X', 'description' => 'Processeur 8 coeurs / 16 threads', 'price' => 199.99, 'stock_quantity' => 18, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'Intel Core i5-13400F', 'description' => 'Processeur 10 coeurs / 16 threads', 'price' => 189.00, 'stock_quantity' => 22, 'seller' => 'TechWorld', 'is_active' => true],
            ['name' => 'AMD Ryzen 9 5950X', 'description' => 'Processeur 16 coeurs / 32 threads', 'price' => 379.99, 'stock_quantity' => 7, 'seller' => 'PCMaster', 'is_active' => true],
            ['name' => 'Intel Core i7-13700K', 'description' => 'Processeur 16 coeurs / 24 threads', 'price' => 359.00, 'stock_quantity' => 10, 'seller' => 'BonPrix', 'is_active' => true],
            // Inactive CPU product (should NOT appear in public catalogue)
            ['name' => 'Intel Core i5-12400F (discontinue)', 'description' => 'Processeur 6 coeurs - produit retire du catalogue', 'price' => 199.99, 'stock_quantity' => 0, 'seller' => 'PCMaster', 'is_active' => false],
        ];

        // ─── GPU products (5 active) ───────────────────────────────────
        $gpuProducts = [
            ['name' => 'NVIDIA GeForce RTX 4090', 'description' => 'Carte graphique haut de gamme', 'price' => 1799.99, 'stock_quantity' => 3, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'AMD Radeon RX 7900 XTX', 'description' => 'Carte graphique AMD flagship', 'price' => 999.99, 'stock_quantity' => 6, 'seller' => 'PCMaster', 'is_active' => true],
            ['name' => 'NVIDIA GeForce RTX 4070 Ti', 'description' => 'Carte graphique gaming', 'price' => 799.99, 'stock_quantity' => 14, 'seller' => 'TechWorld', 'is_active' => true],
            ['name' => 'AMD Radeon RX 7800 XT', 'description' => 'Carte graphique 1440p', 'price' => 499.99, 'stock_quantity' => 20, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'NVIDIA GeForce RTX 4060', 'description' => 'Carte graphique 1080p', 'price' => 299.99, 'stock_quantity' => 30, 'seller' => 'BonPrix', 'is_active' => true],
        ];

        // ─── RAM products (4 active) ───────────────────────────────────
        $ramProducts = [
            ['name' => 'Corsair Vengeance DDR5 32Go', 'description' => 'Kit DDR5 2x16Go 6000MHz', 'price' => 109.99, 'stock_quantity' => 45, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'G.Skill Trident Z5 RGB 32Go', 'description' => 'Kit DDR5 2x16Go 6400MHz', 'price' => 139.99, 'stock_quantity' => 20, 'seller' => 'PCMaster', 'is_active' => true],
            ['name' => 'Kingston Fury Beast DDR5 16Go', 'description' => 'Kit DDR5 2x8Go 5600MHz', 'price' => 59.99, 'stock_quantity' => 60, 'seller' => 'BonPrix', 'is_active' => true],
            ['name' => 'Corsair Dominator Platinum DDR5 64Go', 'description' => 'Kit DDR5 2x32Go 5600MHz', 'price' => 219.99, 'stock_quantity' => 8, 'seller' => 'TechWorld', 'is_active' => true],
        ];

        // ─── Other category products (2 per category for Story 3.3 filter tests) ────
        $otherProducts = [
            // Stockage (2 products)
            ['name' => 'Samsung 990 Pro 2To', 'description' => 'SSD NVMe M.2 PCIe 4.0', 'category' => 'stockage', 'price' => 159.99, 'stock_quantity' => 30, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'WD Black SN850X 1To', 'description' => 'SSD NVMe M.2 PCIe 4.0', 'category' => 'stockage', 'price' => 89.99, 'stock_quantity' => 25, 'seller' => 'PCMaster', 'is_active' => true],
            // Carte Mere (2 products)
            ['name' => 'ASUS ROG Strix B650E-F', 'description' => 'Carte mere ATX AM5 DDR5', 'category' => 'cm', 'price' => 279.99, 'stock_quantity' => 12, 'seller' => 'HardwareShop', 'is_active' => true],
            ['name' => 'MSI MAG B650 Tomahawk', 'description' => 'Carte mere ATX AM5 DDR5 WiFi', 'category' => 'cm', 'price' => 219.99, 'stock_quantity' => 15, 'seller' => 'TechWorld', 'is_active' => true],
            // Alimentation (2 products)
            ['name' => 'Corsair RM850x', 'description' => 'Alimentation 850W 80+ Gold modulaire', 'category' => 'alimentation', 'price' => 129.99, 'stock_quantity' => 20, 'seller' => 'PCMaster', 'is_active' => true],
            ['name' => 'Seasonic Focus GX-750', 'description' => 'Alimentation 750W 80+ Gold modulaire', 'category' => 'alimentation', 'price' => 109.99, 'stock_quantity' => 22, 'seller' => 'BonPrix', 'is_active' => true],
            // Boitier (2 products)
            ['name' => 'Fractal Design North', 'description' => 'Boitier ATX avec facade bois et mesh', 'category' => 'boitier', 'price' => 149.99, 'stock_quantity' => 18, 'seller' => 'TechWorld', 'is_active' => true],
            ['name' => 'NZXT H7 Flow', 'description' => 'Boitier ATX avec flux d\'air optimise', 'category' => 'boitier', 'price' => 129.99, 'stock_quantity' => 14, 'seller' => 'HardwareShop', 'is_active' => true],
            // Peripheriques (2 products)
            ['name' => 'Logitech MX Master 3S', 'description' => 'Souris sans fil ergonomique', 'category' => 'peripheriques', 'price' => 99.99, 'stock_quantity' => 40, 'seller' => 'BonPrix', 'is_active' => true],
            ['name' => 'Corsair K70 RGB Pro', 'description' => 'Clavier mecanique gaming Cherry MX', 'category' => 'peripheriques', 'price' => 159.99, 'stock_quantity' => 28, 'seller' => 'PCMaster', 'is_active' => true],
        ];

        // Seed CPU products
        foreach ($cpuProducts as $productData) {
            $seller = $sellers[$productData['seller']];
            Product::updateOrCreate(
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                ],
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                    'description' => $productData['description'],
                    'category' => ProductCategory::CPU->value,
                    'price' => $productData['price'],
                    'stock_quantity' => $productData['stock_quantity'],
                    'is_active' => $productData['is_active'],
                ]
            );
        }

        // Seed GPU products
        foreach ($gpuProducts as $productData) {
            $seller = $sellers[$productData['seller']];
            Product::updateOrCreate(
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                ],
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                    'description' => $productData['description'],
                    'category' => ProductCategory::GPU->value,
                    'price' => $productData['price'],
                    'stock_quantity' => $productData['stock_quantity'],
                    'is_active' => $productData['is_active'],
                ]
            );
        }

        // Seed RAM products
        foreach ($ramProducts as $productData) {
            $seller = $sellers[$productData['seller']];
            Product::updateOrCreate(
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                ],
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                    'description' => $productData['description'],
                    'category' => ProductCategory::RAM->value,
                    'price' => $productData['price'],
                    'stock_quantity' => $productData['stock_quantity'],
                    'is_active' => $productData['is_active'],
                ]
            );
        }

        // ─── Ensure product with ID=101 exists (referenced in E2E detail tests) ─
        $product101 = Product::find(101);
        if (!$product101) {
            // Insert a known product at ID 101 for E2E tests
            \Illuminate\Support\Facades\DB::table('products')->insert([
                'id' => 101,
                'seller_id' => $sellers['HardwareShop']->id,
                'name' => 'AMD Ryzen 9 7950X3D',
                'description' => 'Processeur haut de gamme avec 3D V-Cache, 16 coeurs, 32 threads',
                'category' => ProductCategory::CPU->value,
                'price' => 699.99,
                'stock_quantity' => 10,
                'is_active' => true,
                'photo_url' => 'https://via.placeholder.com/300x300.png?text=Ryzen+9+7950X3D',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Seed other category products
        foreach ($otherProducts as $productData) {
            $seller = $sellers[$productData['seller']];
            Product::updateOrCreate(
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                ],
                [
                    'seller_id' => $seller->id,
                    'name' => $productData['name'],
                    'description' => $productData['description'],
                    'category' => $productData['category'],
                    'price' => $productData['price'],
                    'stock_quantity' => $productData['stock_quantity'],
                    'is_active' => $productData['is_active'],
                ]
            );
        }
    }
}
