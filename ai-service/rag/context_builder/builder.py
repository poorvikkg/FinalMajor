"""Context Builder for Surveillance & PCIS RAG."""

from typing import List, Dict, Any
from langchain_core.documents import Document


class ContextBuilder:
    """Builds structured Markdown prompts from retrieved records across MongoDB & FAISS."""

    @staticmethod
    def build_mongo_context(records: List[Dict[str, Any]]) -> str:
        """Format MongoDB multi-collection records cleanly for the LLM."""
        if not records:
            return "No exact database records found in MongoDB."

        complaint_parts = []
        alert_parts = []
        sighting_parts = []
        camera_parts = []
        unknown_parts = []
        other_parts = []

        for record in records:
            coll = record.get("_collection", "complaints")
            
            if coll == "complaints":
                cid = record.get("complaintId") or record.get("firNumber") or record.get("_id")
                name = record.get("missingPersonName") or record.get("name") or "Not explicitly named"
                inc_type = record.get("type") or "Missing Person / Incident"
                status = record.get("status") or "ACTIVE"
                priority = record.get("priority") or "NORMAL"
                loc = record.get("lastSeenLocation") or "Not specified"
                time_val = record.get("lastSeenTime") or record.get("incidentAt") or record.get("createdAt") or "Recent"
                
                # Reporter / Filer Info
                reporter = record.get("reporterName") or record.get("name") or "Anonymous/Unknown"
                rep_contact = record.get("reporterMobile") or record.get("phone") or record.get("email") or "None"
                rep_rel = record.get("reporterRelationship") or "Complainant"

                # Subject Physical Details
                phys_traits = []
                if record.get("age"): phys_traits.append(f"Age: {record.get('age')}")
                if record.get("gender") and record.get("gender") != "unknown": phys_traits.append(f"Gender: {record.get('gender')}")
                if record.get("height"): phys_traits.append(f"Height: {record.get('height')}")
                if record.get("weight"): phys_traits.append(f"Weight: {record.get('weight')}")
                if record.get("skinTone"): phys_traits.append(f"Complexion: {record.get('skinTone')}")
                if record.get("clothesWorn"): phys_traits.append(f"Clothing: {record.get('clothesWorn')}")
                if record.get("identifyingMarks"): phys_traits.append(f"Marks/Tattoos: {record.get('identifyingMarks')}")

                police_station = record.get("policeStation") or "Not assigned"
                officer = record.get("officerName") or "Investigating Officer"
                desc = record.get("description") or record.get("additionalDescription") or ""
                remarks = record.get("remarks") or ""

                c_text = [
                    f"- **Case / Report ID**: {cid}",
                    f"  - **Type**: {inc_type} | **Status**: {status} | **Priority**: {priority}",
                    f"  - **Subject / Missing Person**: {name}",
                ]
                if phys_traits:
                    c_text.append(f"  - **Physical Profile**: {', '.join(phys_traits)}")
                c_text.append(f"  - **Filer / Complainant**: {reporter} ({rep_rel}, Contact: {rep_contact})")
                c_text.append(f"  - **Location & Time**: {loc} | Date: {time_val}")
                c_text.append(f"  - **Police Station**: {police_station} (Officer: {officer})")
                if desc:
                    c_text.append(f"  - **Case Details & Incident Summary**:\n    {desc.strip()}")
                if remarks:
                    c_text.append(f"  - **Officer Remarks**: {remarks.strip()}")
                
                complaint_parts.append("\n".join(c_text))

            elif coll == "suspectalerts":
                aid = record.get("alertId") or record.get("_id")
                label = record.get("suspectLabel") or "Unknown Suspect"
                st = record.get("status") or "ACTIVE"
                sim = record.get("triggerSimilarity", 0.0)
                relay = record.get("relayChain") or []

                a_text = [
                    f"- **Suspect Chase Alert ID**: {aid}",
                    f"  - **Suspect**: {label} | **Status**: {st} | **Initial Match Confidence**: {round(sim * 100, 1)}%",
                ]
                if relay:
                    hops = []
                    for h in relay:
                        c_name = h.get("cameraName") or "Camera"
                        l_name = h.get("locationName") or "Area"
                        t = h.get("detectedAt") or ""
                        conf = round(h.get("similarity", 0) * 100, 1)
                        hops.append(f"[{c_name} at {l_name} ({conf}%) @ {t}]")
                    a_text.append(f"  - **Camera Detection Trail (Relay Chain)**: {' -> '.join(hops)}")
                alert_parts.append("\n".join(a_text))

            elif coll == "sightings":
                pname = record.get("personName") or "Unknown"
                cname = record.get("cameraName") or "Surveillance Camera"
                lname = record.get("locationName") or "Camera Location"
                time_s = record.get("timestamp") or record.get("createdAt") or ""
                conf = round(record.get("confidence", 0) * 100, 1)
                sighting_parts.append(f"- **Detection**: {pname} detected on **{cname}** ({lname}) with {conf}% confidence at {time_s}")

            elif coll == "cameras":
                name = record.get("name") or "Camera"
                loc = record.get("locationName") or "Zone Area"
                zone = record.get("zone") or "Default Zone"
                st = record.get("status") or "ONLINE"
                camera_parts.append(f"- **Camera '{name}'**: Location: {loc} | Zone: {zone} | Status: {st}")

            elif coll == "unknownpersons":
                uid = record.get("unknownId") or record.get("_id")
                fcount = record.get("faceCount") or 1
                risk = record.get("riskLevel") or "MEDIUM"
                st = record.get("status") or "NEW"
                unknown_parts.append(f"- **Unknown Person Cluster {uid}**: Status: {st} | Risk Level: {risk} | Sighting Count: {fcount}")

            else:
                other_parts.append(f"- Record ({coll}): {str(record)}")

        output_sections = []
        if complaint_parts:
            output_sections.append("### Active & Historical Complaints / Case Records:\n" + "\n\n".join(complaint_parts))
        if alert_parts:
            output_sections.append("### Suspect Chase & Active Relay Alerts:\n" + "\n\n".join(alert_parts))
        if sighting_parts:
            output_sections.append("### Camera Network Sightings & Detections:\n" + "\n".join(sighting_parts))
        if unknown_parts:
            output_sections.append("### Recurring Unknown Person Clusters:\n" + "\n".join(unknown_parts))
        if camera_parts:
            output_sections.append("### Surveillance Camera Deployments:\n" + "\n".join(camera_parts))
        if other_parts:
            output_sections.append("### Additional Records:\n" + "\n".join(other_parts))

        return "\n\n".join(output_sections)

    @staticmethod
    def build_vector_context(documents: List[Document]) -> str:
        """Format FAISS vector documents cleanly."""
        if not documents:
            return ""

        context_parts = ["### Relevant Statistical Datasets & Reference Knowledge:"]
        for doc in documents:
            meta = doc.metadata
            source = meta.get("dataset_name") or meta.get("source") or meta.get("source_file") or "Crime Statistics Dataset"
            state = meta.get("state") or meta.get("district") or ""
            year = meta.get("year") or ""

            header = f"**Source:** {source}"
            if state or year:
                header += f" ({state} {year})".strip()
            context_parts.append(header)
            context_parts.append(f"{doc.page_content.strip()}")
            context_parts.append("---")

        return "\n".join(context_parts)

    @classmethod
    def build(cls, mongo_records: List[Dict[str, Any]], vector_docs: List[Document]) -> str:
        """Merge both contexts into a final structured prompt block."""
        mongo_ctx = cls.build_mongo_context(mongo_records)
        vector_ctx = cls.build_vector_context(vector_docs)

        if mongo_ctx and vector_ctx:
            return f"{mongo_ctx}\n\n{vector_ctx}"
        elif mongo_ctx:
            return mongo_ctx
        elif vector_ctx:
            return vector_ctx
        return "No specific database or statistical records found."
