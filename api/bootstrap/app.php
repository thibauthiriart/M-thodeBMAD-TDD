<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Force JSON error responses for all API routes (BUG-001 fix)
        // Without this, ValidationException on API routes without Accept: application/json
        // header would return HTML redirect instead of JSON error response.
        $exceptions->shouldRenderJsonWhen(function ($request, $throwable) {
            return $request->is('api/*');
        });
    })->create();
