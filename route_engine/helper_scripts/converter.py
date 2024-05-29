import ogr2osm

class SwissTLMConverter(ogr2osm.TranslationBase):

    def translateName(self, name):
        return name.strip()


    def filter_tags(self, attrs):
        if not attrs:
            return
        tags = {}

        # TODO: differentiate between different road types

        if 'STRNAME' in attrs:
            translated = self.translateName(attrs['STRNAME'].title())
            tags['name'] = translated

        if 'OBJEKTART' in attrs:
            tags['highway'] = 'road'

        return tags