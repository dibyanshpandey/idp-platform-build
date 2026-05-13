import fitz  # PyMuPDF
import os

output_dir = "../samples"
os.makedirs(output_dir, exist_ok=True)

# --- Sample 1: PII Test Sample ---
doc1 = fitz.open()
page1 = doc1.new_page()

text1 = """
INVOICE #INV-2026-001
Date: 2026-05-11

Billed To:
John Doe
john.doe@example.com

Payment Details:
Card Number: 4111-1111-1111-1111
Amount Due: $1,500.00

Employee SSN for records: 123-45-6789
"""

page1.insert_text((50, 50), text1, fontsize=12)
doc1.save(os.path.join(output_dir, "PII_Test_Sample.pdf"))
doc1.close()
print("Created PII_Test_Sample.pdf")


# --- Sample 2: Fraud Test Sample (Metadata + Hidden Text) ---
doc2 = fitz.open()
page2 = doc2.new_page()

text2 = """
CLAIM SETTLEMENT DOCUMENT
Status: APPROVED
Total Payout: $10,000.00
"""

page2.insert_text((50, 50), text2, fontsize=12)
page2.insert_text((50, 200), "ORIGINAL AMOUNT: $500.00", fontsize=12, color=(1, 1, 1))

doc2.set_metadata({
    "creator": "Adobe Photoshop / ImageMagick",
    "producer": "GIMP",
    "title": "Forged Document"
})

doc2.save(os.path.join(output_dir, "Fraud_Test_Sample.pdf"))
doc2.close()
print("Created Fraud_Test_Sample.pdf")


# --- Sample 3: Incremental Update Test ---
# Create a clean PDF, save it, then modify and re-save to create incremental updates
doc3 = fitz.open()
page3 = doc3.new_page()
page3.insert_text((50, 50), "ORIGINAL INVOICE\nTotal: $500.00", fontsize=14)
doc3.save(os.path.join(output_dir, "Tampered_Invoice.pdf"))
doc3.close()

# Now re-open and modify (this creates an incremental update with a second %%EOF)
doc3b = fitz.open(os.path.join(output_dir, "Tampered_Invoice.pdf"))
page3b = doc3b.load_page(0)
page3b.insert_text((50, 150), "MODIFIED: Total changed to $5,000.00", fontsize=14, color=(1, 0, 0))
doc3b.save(os.path.join(output_dir, "Tampered_Invoice.pdf"), incremental=True, encryption=0)
doc3b.close()
print("Created Tampered_Invoice.pdf (with incremental update)")


# --- Sample 4: Font Anomaly Test ---
doc4 = fitz.open()
page4 = doc4.new_page()

# Write text in default font (Helvetica)
page4.insert_text((50, 50), "Amazon Web Services Invoice\nAccount: 123456789\nTotal: $1,200.00", fontsize=12)

# Insert text with a DIFFERENT font (Courier) to simulate injected text
page4.insert_text((50, 200), "APPROVED FOR PAYMENT", fontsize=14, fontname="cour")

doc4.save(os.path.join(output_dir, "Font_Anomaly_Sample.pdf"))
doc4.close()
print("Created Font_Anomaly_Sample.pdf (mixed fonts)")


# --- Sample 5: Vendor Profile Test (first upload creates profile) ---
doc5 = fitz.open()
page5 = doc5.new_page()
page5.insert_text((50, 50), "Acme Corp\nInvoice #AC-001\nDate: 2026-05-01\nTotal: $750.00", fontsize=12)
doc5.set_metadata({
    "creator": "Acme Billing System v2.1",
    "producer": "Acme PDF Generator"
})
doc5.save(os.path.join(output_dir, "Vendor_Profile_Baseline.pdf"))
doc5.close()
print("Created Vendor_Profile_Baseline.pdf (establishes vendor fingerprint)")


# --- Sample 6: Vendor Profile Mismatch Test ---
doc6 = fitz.open()
page6 = doc6.new_page()
page6.insert_text((50, 50), "Acme Corp\nInvoice #AC-002\nDate: 2026-05-10\nTotal: $3,200.00", fontsize=12)
doc6.set_metadata({
    "creator": "Microsoft Word 2019",     # MISMATCH - was "Acme Billing System"
    "producer": "Microsoft PDF Printer"    # MISMATCH - was "Acme PDF Generator"
})
doc6.save(os.path.join(output_dir, "Vendor_Profile_Mismatch.pdf"))
doc6.close()
print("Created Vendor_Profile_Mismatch.pdf (will trigger vendor profile mismatch)")

print("\n✅ All 6 test samples generated successfully!")
