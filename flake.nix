{
  description = "Cross-directory conversation management for Claude Code";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "claude-extras";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun ];

          buildPhase = ''
            export HOME=$TMPDIR
            bun build src/cli.ts --compile --outfile claude-extras
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp claude-extras $out/bin/
          '';
        };

        devShells.default = pkgs.mkShell {
          packages = [ pkgs.bun ];
        };
      });
}
