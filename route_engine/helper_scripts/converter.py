import ogr2osm


class SwissTLMConverter(ogr2osm.TranslationBase):
    def translateName(self, name):
        return name.strip()

    def filter_tags(self, attrs):
        if not attrs:
            return
        tags = {}

        if "STRNAME" in attrs and attrs["STRNAME"] and attrs["STRNAME"] != "Keine":
            translated = self.translateName(attrs["STRNAME"].title())
            tags["name"] = translated

        # Default highway tag
        tags["highway"] = "road"

        if "OBJEKTART" in attrs:
            obj = attrs["OBJEKTART"]
            if obj in ["1m Weg", "2m Weg", "1m Wegfragment", "2m Wegfragment", "Markierte Spur", "Klettersteig"]:
                tags["highway"] = "path"
            elif obj == "Zufahrt" or "Strasse" in obj and obj != "Autostrasse":
                tags["highway"] = "unclassified"
            elif obj in ["Autobahn", "Autostrasse"]:
                tags["highway"] = "motorway"
            else:
                tags["highway"] = "road"

        if "BELAGSART" in attrs:
            belag = attrs["BELAGSART"]
            if belag == "Natur":
                tags["surface"] = "unpaved"
            elif belag == "Hart":
                tags["surface"] = "paved"
            elif belag == "k_W":
                pass # let Valhalla default based on highway tag


        if "KUNSTBAUTE" in attrs:
            var = attrs["KUNSTBAUTE"]
            if var == "Bruecke":
                tags["bridge"] = "yes"
            elif var == "Tunnel":
                tags["tunnel"] = "yes"
            elif var == "Treppe":
                tags["highway"] = "steps"

        # Explicitly tag Wanderwege
        if "WANDERWEGE" in attrs and attrs["WANDERWEGE"] and attrs["WANDERWEGE"] != "Keine":
            tags["route"] = "hiking"
            tags["hiking"] = "yes"

        return tags
