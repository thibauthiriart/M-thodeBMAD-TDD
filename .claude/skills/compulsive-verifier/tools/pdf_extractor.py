#!/usr/bin/env python3
"""
PDF Extractor pour le Verificateur Compulsif
Extrait les donnees d'un releve bancaire PDF et genere des fixtures YAML
"""

import subprocess
import re
import yaml
import sys
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Optional
from datetime import datetime


@dataclass
class Transaction:
    date: str
    libelle: str
    debit: Optional[float]
    credit: Optional[float]
    solde: float


@dataclass
class Metadonnees:
    banque: str
    societe: str
    iban: str
    periode: str


@dataclass
class ReleveBancaire:
    source_file: str
    extracted_at: str
    metadonnees: Metadonnees
    transactions: List[Transaction]
    solde_initial: float
    solde_final: float
    nombre_transactions: int


def extract_pdf_text(pdf_path: str) -> str:
    """Extrait le texte du PDF via pdftotext"""
    result = subprocess.run(
        ["pdftotext", "-layout", pdf_path, "-"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        raise Exception(f"pdftotext error: {result.stderr}")
    return result.stdout


def parse_montant(montant_str: str) -> Optional[float]:
    """Parse un montant francais: '2 744,00 €' -> 2744.00"""
    if not montant_str or montant_str.strip() == "":
        return None
    # Retirer espaces, €, et normaliser
    cleaned = montant_str.replace(" ", "").replace("€", "").replace(",", ".").strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def extract_after(prefix: str, text: str) -> str:
    """Extrait le texte apres un prefix sur la meme ligne"""
    pattern = rf"{re.escape(prefix)}\s*(.+)"
    match = re.search(pattern, text)
    if match:
        return match.group(1).strip()
    return ""


def parse_transaction_line(line: str) -> Optional[Transaction]:
    """Parse une ligne de transaction"""
    # Pattern: date (DD/MM/YYYY) suivi de texte et montants
    date_pattern = r"(\d{2}/\d{2}/\d{4})"

    match = re.match(date_pattern, line.strip())
    if not match:
        return None

    date = match.group(1)
    rest = line[match.end():].strip()

    # Trouver les montants (format: 449,00 € ou 2 744,00 €)
    montant_pattern = r"([\d\s]+,\d{2})\s*€?"
    montants = re.findall(montant_pattern, rest)

    if len(montants) < 1:
        return None

    # Le dernier montant est le solde
    solde = parse_montant(montants[-1])

    # Determiner debit/credit
    debit = None
    credit = None

    if len(montants) >= 2:
        # On a debit ou credit + solde
        # Regarder la position dans la ligne pour determiner debit vs credit
        first_montant_pos = rest.find(montants[0])

        # Heuristique basee sur le format du releve
        # Si le montant est dans la premiere moitie, c'est un debit
        # Sinon c'est un credit
        if len(montants) == 2:
            if first_montant_pos < 30:  # Position approximative
                debit = parse_montant(montants[0])
            else:
                credit = parse_montant(montants[0])
        elif len(montants) == 3:
            debit = parse_montant(montants[0])
            credit = parse_montant(montants[1])

    # Extraire le libelle (entre la date et les montants)
    libelle_end = rest.find(montants[0]) if montants else len(rest)
    libelle = rest[:libelle_end].strip()

    return Transaction(
        date=date,
        libelle=libelle,
        debit=debit,
        credit=credit,
        solde=solde or 0.0
    )


def parse_releve_bancaire(pdf_path: str) -> ReleveBancaire:
    """Parse un releve bancaire PDF complet"""
    text = extract_pdf_text(pdf_path)
    lines = text.split("\n")

    # Extraction metadonnees
    banque = extract_after("Banque :", text)
    societe = extract_after("Société :", text)
    iban = extract_after("IBAN :", text)
    periode = extract_after("Période :", text)

    metadonnees = Metadonnees(
        banque=banque,
        societe=societe,
        iban=iban,
        periode=periode
    )

    # Extraction transactions
    transactions = []
    for line in lines:
        tx = parse_transaction_line(line)
        if tx:
            transactions.append(tx)

    # Extraction totaux
    solde_initial_str = extract_after("Solde initial :", text)
    solde_final_str = extract_after("Solde final :", text)

    solde_initial = parse_montant(solde_initial_str) or 0.0
    solde_final = parse_montant(solde_final_str) or 0.0

    return ReleveBancaire(
        source_file=str(pdf_path),
        extracted_at=datetime.now().isoformat(),
        metadonnees=metadonnees,
        transactions=transactions,
        solde_initial=solde_initial,
        solde_final=solde_final,
        nombre_transactions=len(transactions)
    )


def to_yaml(releve: ReleveBancaire) -> str:
    """Convertit le releve en YAML"""
    data = {
        "source_file": releve.source_file,
        "extracted_at": releve.extracted_at,
        "metadonnees": asdict(releve.metadonnees),
        "totaux": {
            "solde_initial": releve.solde_initial,
            "solde_final": releve.solde_final,
            "nombre_transactions": releve.nombre_transactions
        },
        "transactions": [
            {
                "index": i + 1,
                "date": tx.date,
                "libelle": tx.libelle,
                "debit": tx.debit,
                "credit": tx.credit,
                "solde": tx.solde
            }
            for i, tx in enumerate(releve.transactions)
        ]
    }
    return yaml.dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False)


def main():
    if len(sys.argv) < 2:
        print("Usage: python pdf_extractor.py <pdf_path> [output.yaml]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"📄 Extraction de: {pdf_path}")

    try:
        releve = parse_releve_bancaire(pdf_path)
        yaml_content = to_yaml(releve)

        if output_path:
            Path(output_path).write_text(yaml_content)
            print(f"✅ Fixture generee: {output_path}")
        else:
            print("\n" + yaml_content)

        print(f"\n📊 Resume:")
        print(f"   Banque: {releve.metadonnees.banque}")
        print(f"   Societe: {releve.metadonnees.societe}")
        print(f"   Periode: {releve.metadonnees.periode}")
        print(f"   Transactions: {releve.nombre_transactions}")
        print(f"   Solde initial: {releve.solde_initial:,.2f} €")
        print(f"   Solde final: {releve.solde_final:,.2f} €")

    except Exception as e:
        print(f"❌ Erreur: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
