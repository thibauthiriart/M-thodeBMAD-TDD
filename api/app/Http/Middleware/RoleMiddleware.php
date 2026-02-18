<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * Check that the authenticated user has one of the required roles.
     * Usage: middleware('role:vendeur') or middleware('role:vendeur,admin')
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles  One or more allowed roles
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        // If not authenticated, let auth middleware handle it (should return 401)
        if (!$user) {
            return response()->json([
                'message' => 'Non authentifié.',
            ], 401);
        }

        // Check if user's role is in the allowed roles
        if (!in_array($user->role, $roles, true)) {
            return response()->json([
                'message' => 'Vous n\'avez pas les droits pour accéder à cette ressource.',
            ], 403);
        }

        return $next($request);
    }
}
